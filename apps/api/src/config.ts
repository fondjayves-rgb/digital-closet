export interface Config {
  port: number; webOrigin: string; supabaseUrl: string; publishableKey: string;
  secretKey: string; openaiKey: string; model: string;
}
export function readConfig(): Config {
  const value = (name: string) => { const text = process.env[name]?.trim() || ''; return /YOUR_PROJECT|^your-/i.test(text) ? '' : text; };
  return {
    port: Number(process.env.PORT || 3001), webOrigin: process.env.WEB_ORIGIN || 'http://127.0.0.1:5173',
    supabaseUrl: value('SUPABASE_URL'), publishableKey: value('SUPABASE_PUBLISHABLE_KEY'),
    secretKey: value('SUPABASE_SECRET_KEY'), openaiKey: value('OPENAI_API_KEY'),
    model: value('OPENAI_MODEL'),
  };
}
export function missingSetup(config: Config) {
  return [!config.supabaseUrl && 'SUPABASE_URL', !config.publishableKey && 'SUPABASE_PUBLISHABLE_KEY'].filter(Boolean) as string[];
}
