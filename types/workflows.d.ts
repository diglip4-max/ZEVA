export type WorkflowEntity =
  | "Lead"
  | "Patient"
  | "Appointment"
  | "Webhook"
  | "Message";

export type Workflow = {
  _id: string;
  clinicId: string;
  name: string;
  description?: string;
  entity: WorkflowEntity;
  status: "Active" | "Inactive";
  trigger?: string;
  runs?: number;
  successRate?: number;
  lastRun?: Date;
  ownerId: string;
  nodes?: any[];
  edges?: any[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: string;
  updatedAt: string;
};
