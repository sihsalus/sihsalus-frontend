export interface Observation {
  uuid: string;
  concept: {
    uuid: string;
    display: string;
  };
  display: string;
  groupMembers: null | Array<{
    uuid: string;
    concept: {
      uuid: string;
      display: string;
    };
    value: {
      uuid: string;
      display: string;
    };
    display: string;
  }>;
  value: string | number | { uuid: string; display: string } | null;
  obsDatetime?: string;
}

export interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterType: {
    uuid: string;
    display?: string;
  };
  form: {
    uuid: string;
    name?: string;
    display?: string;
  };
  visit?: {
    visitType?: {
      display?: string;
    };
  };
  encounterProviders?: Array<{
    provider: {
      display?: string;
      person?: {
        display?: string;
      };
    };
  }>;
  obs?: Array<Observation>;
}
