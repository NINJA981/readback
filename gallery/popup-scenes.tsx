import { DEFAULT_SETTINGS, setSiteEnabled } from '../src/state/settings';
import type { TabStatus } from '../src/storage/tab-status';
import { PopupView } from '../src/ui/PopupView';
import type { PopupActions, PopupViewProps } from '../src/ui/PopupView';

export const POPUP_SCENES = [
  'popup:reading',
  'popup:reading-clean',
  'popup:reading-unconfirmed',
  'popup:idle',
  'popup:idle-no-playground',
  'popup:idle-mail',
  'popup:layout-error',
  'popup:off',
  'popup:selection',
  'popup:checking',
];

const noop = (): void => undefined;
const actions: PopupActions = {
  toggleSite: noop,
  toggleGuard: noop,
  openOptions: noop,
  openPlayground: noop,
  openGmail: noop,
  openPrivacy: noop,
  openLedger: noop,
  openSlip: noop,
  clearContext: noop,
  copyDiagnostics: noop,
};

const status = (patch: Partial<TabStatus>): TabStatus => ({
  state: 'reading',
  asks: 0,
  open: 0,
  unconfirmed: 0,
  slips: 0,
  contextWords: 0,
  failedChecks: [],
  updatedAt: 0,
  ...patch,
});

export function PopupScene({ name }: { name: string }) {
  const gmail = 'https://mail.google.com/mail/u/0/#inbox/18c4a1f2b3d4e5f6';
  const base: PopupViewProps = {
    settings: DEFAULT_SETTINGS,
    url: gmail,
    host: 'mail.google.com',
    status: status({}),
    slips: [],
    checking: false,
    playground: true,
    diagnosticsCopied: false,
    actions,
  };
  let props: PopupViewProps = base;
  switch (name) {
    case 'reading':
      props = {
        ...base,
        status: status({ asks: 3, open: 1, slips: 1 }),
        slips: [{ found: 'Catherine', expected: 'Kathryn', message: 'Signs as Kathryn' }],
      };
      break;
    case 'reading-clean':
      props = { ...base, status: status({ asks: 3, open: 0, unconfirmed: 0, slips: 0 }) };
      break;
    case 'reading-unconfirmed':
      props = { ...base, status: status({ asks: 3, open: 0, unconfirmed: 3, slips: 0 }) };
      break;
    case 'idle':
      props = { ...base, url: 'https://example.com/', host: 'example.com', status: undefined };
      break;
    case 'idle-no-playground':
      props = {
        ...base,
        url: 'https://example.com/',
        host: 'example.com',
        status: undefined,
        playground: false,
      };
      break;
    case 'idle-mail':
      props = { ...base, status: status({ state: 'idle' }) };
      break;
    case 'layout-error':
      props = {
        ...base,
        status: status({ state: 'layout-unrecognised', failedChecks: ['thread'] }),
      };
      break;
    case 'off':
      props = {
        ...base,
        settings: setSiteEnabled(DEFAULT_SETTINGS, 'https://mail.google.com', false),
        status: status({ state: 'site-off' }),
      };
      break;
    case 'selection':
      props = {
        ...base,
        url: 'https://example.com/thread',
        host: 'example.com',
        status: status({ state: 'selection-context', contextWords: 84 }),
      };
      break;
    case 'checking':
      props = { ...base, status: undefined, checking: true };
      break;
  }
  return (
    <div className="stage stage-popup">
      <PopupView {...props} />
    </div>
  );
}
