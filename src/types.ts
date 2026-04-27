export interface Process {
  id: string;
  name: string;
  sector: string;
  origin: string;
  function: string;
  createdAt: string;
}

export interface Step {
  id: string;
  processId: string;
  name: string;
  order: number;
  isHeading?: boolean;
  unitOfMeasure?: string;
  referenceTime?: number;
  targetQty?: number;
}

export interface StudySession {
  id: string;
  processId: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  status: 'in-progress' | 'completed';
  iterationName?: string;
}

export interface Measurement {
  id: string;
  sessionId: string;
  stepId: string;
  subStepId?: string;
  parentStepId?: string;
  duration: number;
  timestamp: string;
  quantity?: number;
}
