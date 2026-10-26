import type { PropsWithChildren } from "react";
import { Page } from "@/features/resident/resident-ui";
export function AppScreen({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <Page title={title} subtitle={description}>
      {children}
    </Page>
  );
}
