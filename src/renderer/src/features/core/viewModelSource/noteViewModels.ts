import type { NoteDetail, NoteSummary } from "@shared/ipc/contracts";
import type { NoteViewModel } from "../coreViewModels";
import { shortDateTime } from "./dateFormat";

export function noteViewModel(note: NoteDetail | NoteSummary): NoteViewModel {
  return {
    id: note.id,
    title: note.title,
    body: "body" in note ? note.body : "",
    preview: note.preview,
    updatedLabel: shortDateTime(note.updatedAt)
  };
}
