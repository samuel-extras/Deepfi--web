export interface SetReferrerInput {
  referralCode: string;
}

export interface SetReferrerResponse {
  id: string;
  referralCode: string;
  referredByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
