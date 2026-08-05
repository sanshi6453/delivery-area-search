const SHEET_NAME = '配達エリア';

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return json_({ updatedAt: new Date().toISOString(), rows: [], error: '配達エリアシートが見つかりません。' });
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return json_({ updatedAt: new Date().toISOString(), rows: [] });
  const headers = values[0].map(String);
  const col = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
  const required = ['ID','都道府県','市町村','市町村よみ','町名','町名よみ','配達店舗','判定','配達曜日','検索方法','注意事項','有効','元データ表記'];
  const missing = required.filter(h => col[h] === undefined);
  if (missing.length) return json_({ updatedAt: new Date().toISOString(), rows: [], error: `不足している列：${missing.join('、')}` });
  const types = {'完全一致':'exact','前方一致':'prefix','市町村全域':'municipality'};
  const rows = values.slice(1).filter(r => r.some(v => String(v).trim())).map(r => ({
    id:r[col['ID']], prefecture:r[col['都道府県']], municipality:r[col['市町村']], municipalityReading:r[col['市町村よみ']],
    town:r[col['町名']], townReading:r[col['町名よみ']], store:r[col['配達店舗']], status:r[col['判定']], deliveryDay:r[col['配達曜日']],
    matchType:types[r[col['検索方法']]] || 'exact', note:r[col['注意事項']],
    enabled:!['FALSE','無効','0'].includes(String(r[col['有効']]).trim().toUpperCase()), sourceText:r[col['元データ表記']]
  }));
  return json_({ updatedAt:new Date().toISOString(), rows });
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
