import type { NoteViewModel } from "../coreViewModels";

export type NoteBoardSelection = "all" | "starred";

export interface NoteViewColumn {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  id: NoteBoardSelection;
  notes: NoteViewModel[];
  title: string;
}
