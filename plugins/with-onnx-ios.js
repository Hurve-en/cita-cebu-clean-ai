const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { withDangerousMod } = require("expo/config-plugins");

const SOURCE = `// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// CebuCleanAI: asynchronous CallInvoker initialization v3.

#import "OnnxruntimeModule.h"
#include "JsiMain.h"
#import <React/RCTCallInvoker.h>
#import <React/RCTCallInvokerModule.h>
#include <exception>

@interface OnnxruntimeModule () <RCTCallInvokerModule>
@end

@implementation OnnxruntimeModule {
  RCTCallInvoker *_cebuCallInvoker;
  BOOL _cebuReady;
}

- (void)setCallInvoker:(RCTCallInvoker *)callInvoker {
  _cebuCallInvoker = callInvoker;
}

- (RCTCallInvoker *)callInvoker {
  return _cebuCallInvoker;
}

RCT_EXPORT_MODULE(Onnxruntime)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_REMAP_METHOD(initialize,
                 initializeWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  if (_cebuCallInvoker == nil) {
    reject(@"ORT_NO_CALL_INVOKER", @"React Native did not supply a CallInvoker.", nil);
    return;
  }

  auto invoker = [_cebuCallInvoker callInvoker];

  if (!invoker) {
    reject(@"ORT_NO_CALL_INVOKER", @"React Native did not supply a CallInvoker.", nil);
    return;
  }

  invoker->invokeAsync([self, invoker, resolve, reject](facebook::jsi::Runtime &runtime) {
    try {
      if (!runtime.global().getProperty(runtime, "OrtApi").isObject()) {
        onnxruntimejsi::install(runtime, invoker);
      }

      self->_cebuReady = runtime.global().getProperty(runtime, "OrtApi").isObject();

      if (self->_cebuReady) {
        resolve(@YES);
      } else {
        reject(@"ORT_INSTALL_FAILED", @"ONNX did not create its JavaScript API.", nil);
      }
    } catch (const std::exception &error) {
      self->_cebuReady = NO;

      NSString *message = [NSString stringWithUTF8String:error.what()];

      reject(
        @"ORT_INSTALL_FAILED",
        message ?: @"ONNX initialization failed.",
        nil
      );
    }
  });
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  return @(_cebuReady);
}

@end
`;

const ACCEPTED_HASHES = new Set([
  "3b5ccc29f01d010cfda7da76ed2423ff916dbd6edb91acc4ae1cd8c4cfacae27",
  "b9ef954cd45f971778fa702ab011c906048de5148ea9d3bb6480008d01a72db1",
]);

module.exports = function withOnnxIos(config) {
  return withDangerousMod(config, [
    "ios",
    async (mod) => {
      const packageFile = require.resolve(
        "onnxruntime-react-native/package.json",
        {
          paths: [mod.modRequest.projectRoot],
        },
      );

      const version = JSON.parse(fs.readFileSync(packageFile, "utf8")).version;

      if (version !== "1.24.3") {
        throw new Error(
          "This adapter requires onnxruntime-react-native 1.24.3.",
        );
      }

      const file = path.join(
        path.dirname(packageFile),
        "ios",
        "OnnxruntimeModule.mm",
      );

      const original = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

      if (original === SOURCE) {
        return mod;
      }

      const hash = crypto.createHash("sha256").update(original).digest("hex");

      const previousAdapter =
        original.includes(
          "// CebuCleanAI: asynchronous CallInvoker initialization v2.",
        ) &&
        original.includes(
          "@property (nonatomic, strong, nullable) RCTCallInvoker *callInvoker;",
        ) &&
        original.includes("@synthesize callInvoker = _callInvoker;");

      if (!ACCEPTED_HASHES.has(hash) && !previousAdapter) {
        throw new Error(
          "Unexpected ONNX native source. Refusing to overwrite it.",
        );
      }

      fs.writeFileSync(file, SOURCE);

      return mod;
    },
  ]);
};
