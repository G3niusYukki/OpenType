export interface Translations {
  // Navigation
  nav: {
    dictate: string;
    history: string;
    dictionary: string;
    settings: string;
  };
  // Home Page
  home: {
    pressToStart: string;
    recording: string;
    transcribing: string;
    copy: string;
    copied: string;
    insertAtCursor: string;
    inserted: string;
    transcriptionResult: string;
    success: string;
    textCopiedToClipboard: string;
    emptyStateTitle: string;
    emptyStateSubtitle: string;
    accessibilityRequired: string;
    accessibilityMessage: string;
    openSettings: string;
  };
  // Settings Page
  settings: {
    title: string;
    general: string;
    language: string;
    languageDescription: string;
    hotkey: string;
    hotkeyDescription: string;
    outputMode: string;
    outputModePaste: string;
    outputModeCopy: string;
    outputModeType: string;
    autoPunctuation: string;
    autoPunctuationDescription: string;
    providers: string;
    providersDescription: string;
    audio: string;
    audioDescription: string;
    about: string;
    version: string;
    website: string;
    reset: string;
    resetDescription: string;
    resetButton: string;
  };
  // History Page
  history: {
    title: string;
    empty: string;
    emptySubtitle: string;
    clearAll: string;
    delete: string;
    copy: string;
    insert: string;
    statusCompleted: string;
    statusError: string;
    date: string;
  };
  // Dictionary Page
  dictionary: {
    title: string;
    description: string;
    empty: string;
    addNew: string;
    word: string;
    replacement: string;
    add: string;
    delete: string;
    edit: string;
    save: string;
    cancel: string;
  };
  // System Status
  status: {
    title: string;
    ready: string;
    notReady: string;
    checking: string;
    clickToCollapse: string;
    clickToExpand: string;
    audioRecording: string;
    ffmpeg: string;
    installed: string;
    notFound: string;
    microphone: string;
    devices: string;
    noDevices: string;
    transcription: string;
    whisper: string;
    model: string;
    modelFile: string;
    found: string;
    cloudProvider: string;
    configured: string;
    notConfigured: string;
    active: string;
    ffmpegRequired: string;
    installCommand: string;
  };
  // Tray
  tray: {
    startDictation: string;
    showWindow: string;
    settings: string;
    quit: string;
  };
  // Errors
  errors: {
    recordingFailed: string;
    transcriptionFailed: string;
    insertFailed: string;
    permissionDenied: string;
  };
}

export const en: Translations = {
  nav: {
    dictate: 'Dictate',
    history: 'History',
    dictionary: 'Dictionary',
    settings: 'Settings',
  },
  home: {
    pressToStart: 'Press {hotkey} to start',
    recording: 'Recording...',
    transcribing: 'Transcribing...',
    copy: 'Copy',
    copied: 'Copied!',
    insertAtCursor: 'Insert at Cursor',
    inserted: 'Inserted!',
    transcriptionResult: 'Transcription Result',
    success: 'Success',
    textCopiedToClipboard: 'Text copied to clipboard (auto-insert unavailable)',
    emptyStateTitle: 'Your transcriptions will appear here',
    emptyStateSubtitle: 'Click the mic or press {hotkey} to start dictating',
    accessibilityRequired: 'Accessibility Permission Required',
    accessibilityMessage: 'OpenType needs Accessibility permission to paste text at your cursor. Text has been copied to clipboard instead.',
    openSettings: 'Open Settings → Privacy & Security → Accessibility',
  },
  settings: {
    title: 'Settings',
    general: 'General',
    language: 'Language',
    languageDescription: 'Select your preferred language for the interface',
    hotkey: 'Global Hotkey',
    hotkeyDescription: 'Keyboard shortcut to start/stop recording',
    outputMode: 'Output Mode',
    outputModePaste: 'Paste at cursor',
    outputModeCopy: 'Copy to clipboard',
    outputModeType: 'Type text',
    autoPunctuation: 'Auto Punctuation',
    autoPunctuationDescription: 'Automatically add punctuation to transcriptions',
    providers: 'AI Providers',
    providersDescription: 'Configure cloud transcription services',
    audio: 'Audio Settings',
    audioDescription: 'Configure audio input and recording settings',
    about: 'About',
    version: 'Version',
    website: 'Website',
    reset: 'Reset Settings',
    resetDescription: 'Reset all settings to default values',
    resetButton: 'Reset All',
  },
  history: {
    title: 'History',
    empty: 'No transcriptions yet',
    emptySubtitle: 'Your transcription history will appear here',
    clearAll: 'Clear All',
    delete: 'Delete',
    copy: 'Copy',
    insert: 'Insert',
    statusCompleted: 'Completed',
    statusError: 'Error',
    date: 'Date',
  },
  dictionary: {
    title: 'Dictionary',
    description: 'Define custom word replacements for technical terms and corrections',
    empty: 'No entries yet',
    addNew: 'Add New Entry',
    word: 'Word',
    replacement: 'Replacement',
    add: 'Add',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
  },
  status: {
    title: 'System Status',
    ready: 'Ready',
    notReady: 'Setup Required',
    checking: 'Checking...',
    clickToCollapse: 'Click to collapse',
    clickToExpand: 'Click to expand',
    audioRecording: 'Audio Recording',
    ffmpeg: 'ffmpeg',
    installed: 'Installed',
    notFound: 'Not found',
    microphone: 'Microphone',
    devices: 'device(s)',
    noDevices: 'No devices',
    transcription: 'Transcription',
    whisper: 'whisper.cpp',
    model: 'Model',
    modelFile: 'Model file',
    found: 'Found',
    cloudProvider: 'Cloud provider',
    configured: 'Configured',
    notConfigured: 'Not configured',
    active: 'Active',
    ffmpegRequired: 'ffmpeg is required for audio recording.',
    installCommand: 'Install with:',
  },
  tray: {
    startDictation: 'Start Dictation',
    showWindow: 'Show Window',
    settings: 'Settings',
    quit: 'Quit',
  },
  errors: {
    recordingFailed: 'Recording failed',
    transcriptionFailed: 'Transcription failed',
    insertFailed: 'Failed to insert text',
    permissionDenied: 'Permission denied',
  },
};

export const zh: Translations = {
  nav: {
    dictate: '听写',
    history: '历史',
    dictionary: '词典',
    settings: '设置',
  },
  home: {
    pressToStart: '按 {hotkey} 开始录音',
    recording: '正在录音...',
    transcribing: '正在转录...',
    copy: '复制',
    copied: '已复制!',
    insertAtCursor: '插入到光标',
    inserted: '已插入!',
    transcriptionResult: '转录结果',
    success: '成功',
    textCopiedToClipboard: '文本已复制到剪贴板（自动插入不可用）',
    emptyStateTitle: '您的转录将显示在这里',
    emptyStateSubtitle: '点击麦克风或按 {hotkey} 开始听写',
    accessibilityRequired: '需要辅助功能权限',
    accessibilityMessage: 'OpenType 需要辅助功能权限才能在光标处粘贴文本。文本已复制到剪贴板。',
    openSettings: '打开设置 → 隐私与安全性 → 辅助功能',
  },
  settings: {
    title: '设置',
    general: '通用',
    language: '语言',
    languageDescription: '选择界面语言',
    hotkey: '全局快捷键',
    hotkeyDescription: '开始/停止录音的键盘快捷键',
    outputMode: '输出模式',
    outputModePaste: '粘贴到光标处',
    outputModeCopy: '复制到剪贴板',
    outputModeType: '输入文本',
    autoPunctuation: '自动标点',
    autoPunctuationDescription: '自动为转录添加标点符号',
    providers: 'AI 提供商',
    providersDescription: '配置云端转录服务',
    audio: '音频设置',
    audioDescription: '配置音频输入和录音设置',
    about: '关于',
    version: '版本',
    website: '网站',
    reset: '重置设置',
    resetDescription: '将所有设置重置为默认值',
    resetButton: '重置全部',
  },
  history: {
    title: '历史记录',
    empty: '暂无转录记录',
    emptySubtitle: '您的转录历史将显示在这里',
    clearAll: '清空全部',
    delete: '删除',
    copy: '复制',
    insert: '插入',
    statusCompleted: '已完成',
    statusError: '错误',
    date: '日期',
  },
  dictionary: {
    title: '词典',
    description: '为技术术语和更正定义自定义词替换',
    empty: '暂无词条',
    addNew: '添加新词条',
    word: '词汇',
    replacement: '替换为',
    add: '添加',
    delete: '删除',
    edit: '编辑',
    save: '保存',
    cancel: '取消',
  },
  status: {
    title: '系统状态',
    ready: '就绪',
    notReady: '需要设置',
    checking: '检查中...',
    clickToCollapse: '点击收起',
    clickToExpand: '点击展开',
    audioRecording: '音频录制',
    ffmpeg: 'ffmpeg',
    installed: '已安装',
    notFound: '未找到',
    microphone: '麦克风',
    devices: '个设备',
    noDevices: '无设备',
    transcription: '转录',
    whisper: 'whisper.cpp',
    model: '模型',
    modelFile: '模型文件',
    found: '已找到',
    cloudProvider: '云端提供商',
    configured: '已配置',
    notConfigured: '未配置',
    active: '当前使用',
    ffmpegRequired: '音频录制需要 ffmpeg。',
    installCommand: '安装命令：',
  },
  tray: {
    startDictation: '开始听写',
    showWindow: '显示窗口',
    settings: '设置',
    quit: '退出',
  },
  errors: {
    recordingFailed: '录音失败',
    transcriptionFailed: '转录失败',
    insertFailed: '插入文本失败',
    permissionDenied: '权限被拒绝',
  },
};

export const ja: Translations = {
  nav: {
    dictate: '音声入力',
    history: '履歴',
    dictionary: '辞書',
    settings: '設定',
  },
  home: {
    pressToStart: '{hotkey} を押して開始',
    recording: '録音中...',
    transcribing: '文字起こし中...',
    copy: 'コピー',
    copied: 'コピーしました!',
    insertAtCursor: 'カーソル位置に挿入',
    inserted: '挿入しました!',
    transcriptionResult: '文字起こし結果',
    success: '成功',
    textCopiedToClipboard: 'テキストをクリップボードにコピーしました（自動挿入は利用できません）',
    emptyStateTitle: '文字起こし結果がここに表示されます',
    emptyStateSubtitle: 'マイクをクリックするか {hotkey} を押して音声入力を開始',
    accessibilityRequired: 'アクセシビリティ権限が必要です',
    accessibilityMessage: 'OpenType はカーソル位置にテキストを貼り付けるためにアクセシビリティ権限が必要です。テキストはクリップボードにコピーされました。',
    openSettings: '設定を開く → プライバシーとセキュリティ → アクセシビリティ',
  },
  settings: {
    title: '設定',
    general: '一般',
    language: '言語',
    languageDescription: 'インターフェースの言語を選択',
    hotkey: 'グローバルショートカット',
    hotkeyDescription: '録音の開始/停止用キーボードショートカット',
    outputMode: '出力モード',
    outputModePaste: 'カーソル位置に貼り付け',
    outputModeCopy: 'クリップボードにコピー',
    outputModeType: 'テキストを入力',
    autoPunctuation: '自動句読点',
    autoPunctuationDescription: '文字起こしに自動的に句読点を追加',
    providers: 'AI プロバイダー',
    providersDescription: 'クラウド文字起こしサービスを設定',
    audio: '音声設定',
    audioDescription: '音声入力と録音設定を構成',
    about: 'について',
    version: 'バージョン',
    website: 'ウェブサイト',
    reset: '設定をリセット',
    resetDescription: 'すべての設定をデフォルト値にリセット',
    resetButton: 'すべてリセット',
  },
  history: {
    title: '履歴',
    empty: 'まだ文字起こしがありません',
    emptySubtitle: '文字起こし履歴がここに表示されます',
    clearAll: 'すべて削除',
    delete: '削除',
    copy: 'コピー',
    insert: '挿入',
    statusCompleted: '完了',
    statusError: 'エラー',
    date: '日付',
  },
  dictionary: {
    title: '辞書',
    description: '技術用語や修正のためのカスタム単語置換を定義',
    empty: 'エントリがありません',
    addNew: '新規追加',
    word: '単語',
    replacement: '置換',
    add: '追加',
    delete: '削除',
    edit: '編集',
    save: '保存',
    cancel: 'キャンセル',
  },
  status: {
    title: 'システム状態',
    ready: '準備完了',
    notReady: 'セットアップが必要',
    checking: '確認中...',
    clickToCollapse: 'クリックで折りたたむ',
    clickToExpand: 'クリックで展開',
    audioRecording: '音声録音',
    ffmpeg: 'ffmpeg',
    installed: 'インストール済み',
    notFound: '未インストール',
    microphone: 'マイク',
    devices: 'デバイス',
    noDevices: 'デバイスなし',
    transcription: '文字起こし',
    whisper: 'whisper.cpp',
    model: 'モデル',
    modelFile: 'モデルファイル',
    found: '見つかりました',
    cloudProvider: 'クラウドプロバイダー',
    configured: '設定済み',
    notConfigured: '未設定',
    active: '使用中',
    ffmpegRequired: '音声録音には ffmpeg が必要です。',
    installCommand: 'インストールコマンド：',
  },
  tray: {
    startDictation: '音声入力を開始',
    showWindow: 'ウィンドウを表示',
    settings: '設定',
    quit: '終了',
  },
  errors: {
    recordingFailed: '録音に失敗しました',
    transcriptionFailed: '文字起こしに失敗しました',
    insertFailed: 'テキストの挿入に失敗しました',
    permissionDenied: '権限が拒否されました',
  },
};

export const ko: Translations = {
  nav: {
    dictate: '받아쓰기',
    history: '기록',
    dictionary: '사전',
    settings: '설정',
  },
  home: {
    pressToStart: '{hotkey} 눌러 시작',
    recording: '녹음 중...',
    transcribing: '전사 중...',
    copy: '복사',
    copied: '복사됨!',
    insertAtCursor: '커서 위치에 삽입',
    inserted: '삽입됨!',
    transcriptionResult: '전사 결과',
    success: '성공',
    textCopiedToClipboard: '텍스트가 클립보드에 복사되었습니다 (자동 삽입 불가)',
    emptyStateTitle: '전사 결과가 여기에 표시됩니다',
    emptyStateSubtitle: '마이크를 클릭하거나 {hotkey}를 눌러 받아쓰기 시작',
    accessibilityRequired: '접근성 권한 필요',
    accessibilityMessage: 'OpenType은 커서 위치에 텍스트를 붙여넣기 위해 접근성 권한이 필요합니다. 텍스트가 클립보드에 복사되었습니다.',
    openSettings: '설정 열기 → 개인 정보 보호 및 보안 → 접근성',
  },
  settings: {
    title: '설정',
    general: '일반',
    language: '언어',
    languageDescription: '인터페이스 언어 선택',
    hotkey: '전역 단축키',
    hotkeyDescription: '녹음 시작/중지용 키보드 단축키',
    outputMode: '출력 모드',
    outputModePaste: '커서 위치에 붙여넣기',
    outputModeCopy: '클립보드에 복사',
    outputModeType: '텍스트 입력',
    autoPunctuation: '자동 구두점',
    autoPunctuationDescription: '전사에 자동으로 구두점 추가',
    providers: 'AI 제공자',
    providersDescription: '클우드 전사 서비스 구성',
    audio: '오디오 설정',
    audioDescription: '오디오 입력 및 녹음 설정 구성',
    about: '정보',
    version: '버전',
    website: '웹사이트',
    reset: '설정 초기화',
    resetDescription: '모든 설정을 기본값으로 초기화',
    resetButton: '모두 초기화',
  },
  history: {
    title: '기록',
    empty: '아직 전사가 없습니다',
    emptySubtitle: '전사 기록이 여기에 표시됩니다',
    clearAll: '모두 지우기',
    delete: '삭제',
    copy: '복사',
    insert: '삽입',
    statusCompleted: '완료',
    statusError: '오류',
    date: '날짜',
  },
  dictionary: {
    title: '사전',
    description: '기술 용어 및 수정을 위한 사용자 지정 단어 치환 정의',
    empty: '항목이 없습니다',
    addNew: '새 항목 추가',
    word: '단어',
    replacement: '대체',
    add: '추가',
    delete: '삭제',
    edit: '편집',
    save: '저장',
    cancel: '취소',
  },
  status: {
    title: '시스템 상태',
    ready: '준비 완료',
    notReady: '설정 필요',
    checking: '확인 중...',
    clickToCollapse: '클릭하여 접기',
    clickToExpand: '클릭하여 펼치기',
    audioRecording: '오디오 녹음',
    ffmpeg: 'ffmpeg',
    installed: '설치됨',
    notFound: '찾을 수 없음',
    microphone: '마이크',
    devices: '장치',
    noDevices: '장치 없음',
    transcription: '전사',
    whisper: 'whisper.cpp',
    model: '모델',
    modelFile: '모델 파일',
    found: '찾음',
    cloudProvider: '클우드 제공자',
    configured: '구성됨',
    notConfigured: '구성되지 않음',
    active: '활성',
    ffmpegRequired: '오디오 녹음에는 ffmpeg가 필요합니다.',
    installCommand: '설치 명령:',
  },
  tray: {
    startDictation: '받아쓰기 시작',
    showWindow: '창 표시',
    settings: '설정',
    quit: '종료',
  },
  errors: {
    recordingFailed: '녹음 실패',
    transcriptionFailed: '전사 실패',
    insertFailed: '텍스트 삽입 실패',
    permissionDenied: '권한 거부됨',
  },
};

export const translations = {
  en,
  zh,
  ja,
  ko,
};

export type Language = keyof typeof translations;

export const supportedLanguages: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

export function detectSystemLanguage(): Language {
  // Get system locale
  const systemLocale = navigator.language || (navigator as any).userLanguage || 'en-US';
  const primaryLanguage = systemLocale.split('-')[0].toLowerCase();
  
  // Map to supported languages
  const languageMap: Record<string, Language> = {
    'en': 'en',
    'zh': 'zh',
    'ja': 'ja',
    'ko': 'ko',
  };
  
  return languageMap[primaryLanguage] || 'en';
}

export function getTranslation(lang: Language): Translations {
  return translations[lang] || translations.en;
}
