import { createFileRoute } from '@tanstack/react-router';
import { TeacherWorkspace } from '@/features/workspace/teacher-workspace';

export const Route = createFileRoute('/teacher')({ component: TeacherWorkspace });
