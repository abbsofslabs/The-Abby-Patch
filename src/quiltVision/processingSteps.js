export const PROCESSING_STEPS = [
  {
    id: 'read',
    label: 'Reading your photo',
    hint: 'Opening the picture you chose.',
  },
  {
    id: 'straighten',
    label: 'Straightening your quilt',
    hint: 'Flattening the angle so blocks look square.',
  },
  {
    id: 'tuning',
    label: 'Choosing the best detail level',
    hint: 'Ignoring busy prints, keeping real seams.',
  },
  {
    id: 'pieces',
    label: 'Finding each fabric piece',
    hint: 'Tracing the sewn shapes — not the pattern on the cloth.',
  },
  {
    id: 'lines',
    label: 'Drawing clean seam lines',
    hint: 'Connecting the dots into smooth outlines.',
  },
  {
    id: 'done',
    label: 'Ready to plan fabrics',
    hint: 'Almost there…',
  },
];

export function stepIndex(stepId) {
  return PROCESSING_STEPS.findIndex((step) => step.id === stepId);
}

export const REFRESH_STEPS = [
  {
    id: 'pieces',
    label: 'Updating your fabric pieces',
    hint: 'Tracing with your new detail level.',
  },
  {
    id: 'lines',
    label: 'Drawing clean seam lines',
    hint: 'Refreshing the outlines.',
  },
  {
    id: 'done',
    label: 'Done',
    hint: '',
  },
];
