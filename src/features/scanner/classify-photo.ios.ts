import { toByteArray } from "base64-js";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "jpeg-js";
import type { InferenceSession, Tensor } from "onnxruntime-react-native";
import { NativeModules } from "react-native";

import labels from "../../../assets/models/labels.json";
import type { WastePrediction } from "./classify-photo";

type Runtime = typeof import("onnxruntime-react-native");

type LoadedModel = {
  session: InferenceSession;
  runtime: Runtime;
};

const SIZE = 224;

const EXPECTED_LABELS = [
  "glass",
  "metal",
  "non-recyclable",
  "organic",
  "paper",
  "plastic",
];

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let sessionPromise: Promise<LoadedModel> | null = null;
let running = false;

async function loadRuntime(): Promise<Runtime> {
  const native = NativeModules.Onnxruntime as
    | { initialize?: () => Promise<boolean> }
    | undefined;

  const globals = globalThis as typeof globalThis & {
    OrtApi?: unknown;
  };

  console.info("[ONNX] Native module:", native ? "present" : "missing");

  if (!native || typeof native.initialize !== "function") {
    throw new Error(
      "[ONNX] Rebuild required: the installed app does not contain the new native initializer.",
    );
  }

  if (typeof globals.OrtApi === "undefined") {
    const initialized = await native.initialize();

    console.info("[ONNX] initialize returned:", initialized);

    console.info(
      "[ONNX] OrtApi available:",
      typeof globals.OrtApi !== "undefined",
    );

    if (typeof globals.OrtApi === "undefined") {
      throw new Error(
        "[ONNX] Initialization completed without creating OrtApi.",
      );
    }
  }

  return import("onnxruntime-react-native");
}

async function getSession(): Promise<LoadedModel> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      if (JSON.stringify(labels) !== JSON.stringify(EXPECTED_LABELS)) {
        throw new Error("The model labels do not match this scanner version.");
      }

      // Metro requires a static require to bundle the model.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modelModule = require("../../../assets/models/waste-classifier.onnx");

      const asset = Asset.fromModule(modelModule);
      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error("The bundled model is unavailable.");
      }

      const modelPath = decodeURIComponent(
        asset.localUri.replace(/^file:\/\//, ""),
      );

      const runtime = await loadRuntime();

      const session = await runtime.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
        intraOpNumThreads: 2,
      });

      if (
        session.inputNames[0] !== "image" ||
        session.outputNames[0] !== "logits"
      ) {
        await session.release();

        throw new Error(
          "The model does not match the expected input and output.",
        );
      }

      return { session, runtime };
    })().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function preparePhoto(uri: string, runtime: Runtime): Promise<Tensor> {
  const context = ImageManipulator.manipulate(uri, {
    maxWidth: 2048,
    maxHeight: 2048,
  });

  let temporaryUri: string | undefined;

  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;

  try {
    context.resize({
      width: SIZE,
      height: SIZE,
    });

    rendered = await context.renderAsync();

    const image = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 1,
      base64: true,
    });

    temporaryUri = image.uri;

    if (!image.base64) {
      throw new Error("The photo could not be decoded.");
    }

    const decoded = decode(toByteArray(image.base64), {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 32,
    });

    if (decoded.width !== SIZE || decoded.height !== SIZE) {
      throw new Error("The photo could not be resized for the model.");
    }

    const pixels = SIZE * SIZE;
    const values = new Float32Array(3 * pixels);

    for (let pixel = 0; pixel < pixels; pixel++) {
      for (let channel = 0; channel < 3; channel++) {
        const value = decoded.data[pixel * 4 + channel] / 255;

        values[channel * pixels + pixel] =
          (value - MEAN[channel]) / STD[channel];
      }
    }

    return new runtime.Tensor("float32", values, [1, 3, SIZE, SIZE]);
  } finally {
    rendered?.release();
    context.release();

    if (temporaryUri && temporaryUri !== uri) {
      try {
        new File(temporaryUri).delete();
      } catch {
        // Cache cleanup must not hide the analysis result.
      }
    }
  }
}

export async function classifyPhoto(uri: string): Promise<WastePrediction> {
  if (running) {
    throw new Error("Another photo is already being analyzed.");
  }

  if (!uri.startsWith("file://")) {
    throw new Error("Choose a local photo from your camera or library.");
  }

  running = true;

  let input: Tensor | undefined;

  let output: Awaited<ReturnType<InferenceSession["run"]>> | undefined;

  try {
    const { session, runtime } = await getSession();

    input = await preparePhoto(uri, runtime);
    output = await session.run({ image: input });

    const logits = output.logits;

    if (
      !logits ||
      logits.type !== "float32" ||
      logits.data.length !== labels.length
    ) {
      throw new Error("The model returned an unexpected result.");
    }

    const values = Array.from(logits.data as Float32Array);

    if (!values.every(Number.isFinite)) {
      throw new Error("The model returned an invalid result.");
    }

    const maximum = Math.max(...values);

    const weights = values.map((value) => Math.exp(value - maximum));

    const total = weights.reduce((sum, value) => sum + value, 0);

    const best = values.indexOf(maximum);

    return {
      label: labels[best],
      score: weights[best] / total,
    };
  } finally {
    running = false;
    input?.dispose();

    if (output) {
      Object.values(output).forEach((tensor) => tensor.dispose());
    }
  }
}
