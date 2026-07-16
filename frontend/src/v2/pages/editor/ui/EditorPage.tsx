import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Center,
  Loader,
  Stack,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { notifications } from '@mantine/notifications';

import { useTRPCClient } from '../../../shared/api';
import { editorColors, langMeta } from '../../../shared/theme';
import { useSession } from '../../../entities/user';
import { useAuthModal } from '../../../features/auth';

import { ConsolePanel } from '../../../features/run-code';
import { ShareModal } from '../../../features/share-snippet';
import AddPackageModal from './AddPackageModal';

import { FILE_NAME_BY_LANGUAGE, STARTER_CODE, SAVE_STATUS_META } from '../lib/constants'
import { type SaveStatus } from "../types";
import EditorHeader from './EditorHeader';
import EditorSidebar from './EditorSidebar'
import EditorStatusBar from './EditorStatusBar'
import { useRunner } from '../../../features/run-code'

// Экран редактора Runit v2 (docs/design/editor.png).
// TODO(#821, #609): серверное исполнение — сейчас JS выполняется в Web Worker,
// остальные языки отвечают заглушкой unsupportedLanguage.

/** Страница редактора сниппетов с Monaco Editor, консолью и сохранением. */
export default function EditorPage() {
  const { id } = useParams();
  const snippetId = id ? Number(id) : null;
  const navigate = useNavigate();
  const trpc = useTRPCClient();
  const { user, isGuest } = useSession();
  const auth = useAuthModal();

  const [name, setName] = useState('');
  const [code, setCode] = useState(STARTER_CODE);
  const [language, setLanguage] = useState('javascript');
  const [slug, setSlug] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('unsaved');
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [shareOpened, setShareOpened] = useState(false);
  const [packageOpened, setPackageOpened] = useState(false);

  // Рефы для стабильных колбэков (хоткей, monaco-команда, debounce).
  const nameRef = useRef(name);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  nameRef.current = name;
  codeRef.current = code;
  languageRef.current = language;

  const { running, lines, stdin, runRef, setStdin, tab, setTab, handleRun, clearLines } = useRunner(code, language)

  const initializedFor = useRef<string>('');

  // --- Данные -------------------------------------------------------------
  const snippetQuery = useQuery({
    queryKey: ['v2-editor-snippet', snippetId],
    queryFn: () => trpc.snippets.getSnippetById.query(snippetId as number),
    enabled: snippetId != null,
    retry: false,
  });

  const ownerQuery = useQuery({
    queryKey: ['v2-editor-owner', snippetQuery.data?.userId],
    queryFn: () => trpc.users.getUserById.query(snippetQuery.data!.userId),
    enabled: snippetQuery.data?.userId != null,
  });

  const draftNameQuery = useQuery({
    queryKey: ['v2-editor-draft-name'],
    queryFn: () => trpc.snippets.generateSnippetName.query(),
    enabled: snippetId == null,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (snippetId != null && snippetQuery.data && initializedFor.current !== `id:${snippetId}`) {
      initializedFor.current = `id:${snippetId}`;
      setName(snippetQuery.data.name);
      setCode(snippetQuery.data.code);
      setLanguage(snippetQuery.data.language ?? 'javascript');
      setSlug(snippetQuery.data.slug);
      setSaveStatus('saved');
    }
  }, [snippetId, snippetQuery.data]);

  useEffect(() => {
    if (snippetId == null && draftNameQuery.data && initializedFor.current === '') {
      initializedFor.current = 'draft';
      setName(draftNameQuery.data.name);
    }
  }, [snippetId, draftNameQuery.data]);

  // --- Сохранение ---------------------------------------------------------
  // TODO(#826): разрешение конфликтов и оффлайн-черновики.
  const savingRef = useRef(false);
  const snippetIdRef = useRef(snippetId);
  snippetIdRef.current = snippetId;

  /** Сохраняет сниппет (создаёт или обновляет) через API. */
  const saveNow = useCallback(async () => {
    if (isGuest || !user) {
      auth.open('register');
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      if (snippetIdRef.current == null) {
        const created = await trpc.snippets.createSnippet.mutate({
          name: nameRef.current,
          code: codeRef.current,
          language: languageRef.current as 'ruby' | 'java' | 'php' | 'python' | 'javascript' | 'html',
          userId: user.id,
        });
        initializedFor.current = `id:${created.id}`;
        setSlug(created.slug);
        setSaveStatus('saved');
        navigate(`/editor/${created.id}`, { replace: true });
      } else {
        await trpc.snippets.updateSnippet.mutate({
          id: snippetIdRef.current,
          name: nameRef.current,
          code: codeRef.current,
          language: languageRef.current as 'ruby' | 'java' | 'php' | 'python' | 'javascript' | 'html',
        });
        setSaveStatus('saved');
      }
    } catch {
      setSaveStatus('unsaved');
      notifications.show({ message: 'Не удалось сохранить сниппет', color: 'red' });
    } finally {
      savingRef.current = false;
    }
  }, [isGuest, user, auth, trpc, navigate]);

  // Автосохранение с debounce 1.5 c — только для сохранённого сниппета юзера.
  useEffect(() => {
    if (saveStatus !== 'unsaved') return undefined;
    if (isGuest || snippetId == null) return undefined;
    const timer = setTimeout(() => {
      void saveNow();
    }, 1500);
    return () => clearTimeout(timer);
  }, [saveStatus, name, code, isGuest, snippetId, saveNow]);

  const markDirty = useCallback(() => setSaveStatus('unsaved'), []);

  /** Обработчик монтирования Monaco Editor: отслеживание позиции курсора и хоткей Ctrl+Enter. */
  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, col: e.position.column });
    });
    // eslint-disable-next-line no-bitwise
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      void runRef.current();
    });
  };

  // --- Ранние состояния ---------------------------------------------------
  if (snippetId != null && snippetQuery.isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (snippetId != null && snippetQuery.isError) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="sm">
          <Text fw={700} fz="lg">Сниппет не найден</Text>
          <Button component={Link} to="/snippets" variant="light">
            К моим сниппетам
          </Button>
        </Stack>
      </Center>
    );
  }

  const meta = langMeta[language] ?? { label: language, dot: '#adb5bd', runnable: false };
  const fileName = FILE_NAME_BY_LANGUAGE[language] ?? 'index.txt';
  const statusMeta = SAVE_STATUS_META[saveStatus];
  const shareUsername = ownerQuery.data?.username ?? user?.username ?? 'guest';

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f8f9fa',
      }}
    >
      {/* ===== Верхняя панель (52px) ===== */}
      <EditorHeader
        setName={setName}
        name={name}
        meta={meta}
        saveNow={saveNow}
        statusMeta={statusMeta}
        setShareOpened={setShareOpened}
        handleRun={handleRun}
        running={running}
        markDirty={markDirty}
      />

      {/* ===== Основная область ===== */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* --- Левый сайдбар (212px) --- */}
        <EditorSidebar fileName={fileName} meta={meta} setPackageOpened={setPackageOpened}/>

        {/* --- Центр: редактор кода --- */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: editorColors.bg,
          }}
        >
          <Box
            style={{
              height: 40,
              flexShrink: 0,
              display: 'flex',
              background: editorColors.panel,
              borderBottom: `1px solid ${editorColors.border}`,
            }}
          >
            <Box
              px="lg"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: editorColors.bg,
                borderTop: `2px solid ${editorColors.accent}`,
                borderRight: `1px solid ${editorColors.border}`,
              }}
            >
              <Text ff="monospace" fz={13} style={{ color: editorColors.text }}>
                {fileName}
              </Text>
            </Box>
          </Box>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor
              theme="vs-dark"
              language={language}
              value={code}
              onChange={(value) => {
                setCode(value ?? '');
                markDirty();
              }}
              onMount={handleEditorMount}
              loading={<Loader color={editorColors.accent} />}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                minimap: { enabled: false },
                tabSize: 2,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 14 },
                renderLineHighlight: 'line',
              }}
            />
          </div>
        </div>

        {/* --- Правая панель: консоль/ввод (~25%) --- */}
        <div style={{ width: '25%', flexShrink: 0, minWidth: 260 }}>
          <ConsolePanel
            tab={tab}
            onTabChange={setTab}
            lines={lines}
            running={running}
            stdin={stdin}
            onStdinChange={setStdin}
            onClear={clearLines}
          />
        </div>
      </div>

      {/* ===== Статус-бар (28px) ===== */}
      <EditorStatusBar meta={meta} cursor={cursor}/>

      <ShareModal
        opened={shareOpened}
        onClose={() => setShareOpened(false)}
        username={shareUsername}
        slug={slug ?? 'draft'}
        saved={snippetIdRef.current != null || slug != null}
      />
      <AddPackageModal opened={packageOpened} onClose={() => setPackageOpened(false)} />
    </div>
  );
}
