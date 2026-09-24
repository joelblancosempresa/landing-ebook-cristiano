// Google Apps Script — guarda los presaves (nombre + email) en la hoja
// "landing-ebook-cristiano" (id fijo abajo, funciona como proyecto standalone
// sin necesidad de estar vinculado a la hoja).
//
// Cómo desplegarlo:
// 1. script.google.com → New project.
// 2. Borra el contenido de Code.gs y pega este archivo entero.
// 3. Guarda (icono disquete).
// 4. Implementar → Nueva implementación → tipo "Aplicación web".
//    - Ejecutar como: Yo
//    - Quién tiene acceso: Cualquier usuario
// 5. Autoriza los permisos cuando lo pida.
// 6. Copia la URL de la aplicación web (termina en /exec) — esa es la que
//    hay que pegar en PRESAVE_SCRIPT_URL dentro de src/App.tsx.

var SPREADSHEET_ID = '1sHRqNkiSng-d9FsLrHnqU0uEgHSHIbGNc2_jtdQZ6wY'

function doPost(e) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();

  // Primera fila de cabeceras, solo si la hoja está vacía.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Fecha', 'Nombre', 'Email']);
  }

  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(), data.nombre || '', data.email || '']);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
