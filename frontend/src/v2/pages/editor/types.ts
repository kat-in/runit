/** Статус сохранения сниппета. */
export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export type Meta = {
  label: string;
  dot: string;
  runnable: boolean;
}

export type EditorHeaderProps = {
    setName: (name: string) => void,
    name: string,
    meta: Meta,
    saveNow: () => void,
    statusMeta: {
      color: string;
      label: string;
    },
    markDirty: () => void,
    handleRun: () => Promise<void>,
    setShareOpened: (v: boolean) => void,
    running: boolean,
}

export type EditorSidebarProps = {
  meta: Meta,
  fileName: string,
  setPackageOpened: (v: boolean) => void
}

export type StatusBarProps = {
  meta: Meta,
  cursor: {
    line: number;
    col: number;
  },
}