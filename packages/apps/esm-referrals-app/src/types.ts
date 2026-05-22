export interface CommunityReferral {
  id: number;
  uuid: string;
  nupi?: string;
  dateReferred?: string;
  referredFrom?: string;
  givenName?: string;
  middleName?: string;
  familyName?: string;
  birthdate?: string;
  gender?: string;
  referralReasons?: ReferralReasons;
  status?: string;
}

export interface ReferralReasons {
  category?: string;
  clinicalNote?: string;
  reasonCode?: string;
  messageId: number;
  referralDate?: string;
}
