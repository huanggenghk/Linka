export interface CreateEventInput {
  name: string;
  description?: string;
  location?: string;
  date?: string;
}

export interface JoinEventInput {
  invite_code: string;
  name: string;
  profile: string;
  contact_info: string;
  user_token?: string;
}

export interface GetAttendeesInput {
  event_id: string;
}

export interface Attendee {
  agent_id: string;
  name: string;
  profile: string;
  contact_info: string;
}
