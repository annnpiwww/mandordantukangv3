# Zero-Grep Policy & Semantic Code Navigation

Alasan:
Melakukan grep file-per-file secara manual memboroskan 5.000-30.000 token context window per sesi.

Hierarki Pencarian:
1. **Semantic Concept Search**: Pencarian semantik (contoh: `semantex --refs "<konsep>"`) untuk mengembalikan baris spesifik tanpa dump file.
2. **Go-To-Definition**: Navigasi definisi simbol (contoh: `xerj def "<simbol>"` atau Serena MCP `find_symbol`) untuk langsung mendapatkan line + signature.
3. **Passage Search**: Cuplikan kode spesifik (contoh: `xerj search "<query>"`).
4. **Call Graph & Blast Radius**: Pemetaan relasi pemanggil/dampak (contoh: `gitnexus context <simbol>` dan `gitnexus impact <simbol>`).
5. **AST Edits**: Pengeditan berbasis AST (contoh: Serena MCP `replace_symbol_body`, `insert_after_symbol`) untuk safe editing tanpa merusak AST.
6. **Fallback Grep Ketat**: Grep HANYA diizinkan untuk exact string non-kode (misal variabel `.env`), string literal langka, atau verifikasi nol referensi. Dilarang grep nama function atau class tanpa alasan khusus.
