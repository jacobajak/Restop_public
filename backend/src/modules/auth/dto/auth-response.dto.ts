export class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenant_id: string | null;
    slug?: string;
  };
}
