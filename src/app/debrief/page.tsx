import { Suspense } from "react";
import DebriefContent from "./DebriefContent";

export default function DebriefPage() {
  return (
    <Suspense fallback={<div>Loading interview results...</div>}>
      <DebriefContent />
    </Suspense>
  );
}
