// ═══════════════════════════════════════
//  CONFIGURATION — le seul fichier à modifier pour le déploiement
// ═══════════════════════════════════════
// 1. Créez un projet gratuit sur https://supabase.com
// 2. Récupérez l'URL et la clé "anon public" dans Project Settings > API
// 3. Collez-les ci-dessous (ces valeurs sont PUBLIQUES par design chez Supabase :
//    la protection des données se fait via les policies RLS côté base, pas en cachant la clé)
const SUPABASE_URL = 'https://ebdnlakdfwqbkwakzmbv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViZG5sYWtkZndxYmt3YWt6bWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODY2MjMsImV4cCI6MjEwNTQ2MjYyM30.IlfYcA7-nMORaTyhW3Mxcfh6JsH6rTxcTFt6rdfBWbc';

const sb = (SUPABASE_URL.includes('VOTRE-PROJET')) ? null : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
