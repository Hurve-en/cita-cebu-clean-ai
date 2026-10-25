export type WastePrediction = {
  label: string;
  score: number;
};

export const classifyPhoto: (
  uri: string,
) => Promise<WastePrediction> = async () => {
  throw new Error(
    "Local classification is currently available in the iPhone development build only.",
  );
};
