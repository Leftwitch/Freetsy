import { cn } from "@freetsy/ui/lib/utils";
import { LanguageSwitcher } from "../app/language-switcher";
import { CoverUpload } from "./cover-upload";
import type { PosterCover } from "./use-poster-cover";

export function CoverStage({ cover }: { cover: PosterCover }) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-upload-stage w-full max-w-2xl flex-col justify-center gap-lg py-xl",
      )}
    >
      <CoverUpload
        previewUrl={null}
        onFile={cover.upload}
        onRemove={cover.remove}
        error={cover.failure}
        size="lg"
      />
      <div className={cn("flex justify-center")}>
        <LanguageSwitcher showLabel />
      </div>
    </div>
  );
}
