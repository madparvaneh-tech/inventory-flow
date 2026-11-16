import { Badge } from '../../../components/ui/Badge';
import type { DocumentStatus } from '../../../types';

const LABELS: Record<DocumentStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تأییدشده',
  reversed: 'ابطال‌شده',
};

const VARIANTS: Record<DocumentStatus, 'muted' | 'success' | 'danger'> = {
  draft: 'muted',
  confirmed: 'success',
  reversed: 'danger',
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant={VARIANTS[status]} size="md">
      {LABELS[status]}
    </Badge>
  );
}
