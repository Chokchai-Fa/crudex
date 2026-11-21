import { checkAssessment, type Assessment } from './fractions';
import { ToolError } from '../tools/identity';

/** Throws unless the set passes the exact check; call before anything is saved or shown to a teacher. */
export function assertVerifiedAssessment(assessment: Assessment, expectedCount?: number): void {
  const result = checkAssessment(assessment, { expectedCount });
  if (!result.ok) {
    throw new ToolError(
      'invalid_assessment',
      result.errors.map((e) => `${e.questionId ?? '-'}: ${e.code} ${e.message}`).join('; '),
    );
  }
}
