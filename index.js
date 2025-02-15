const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const showdown  = require('showdown');
require('dotenv').config();

const first = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>@att reporter</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
    </head>
    <body>`;
const after = `</body></html>`;
const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const put = (map, visit) => {
    const key = `${visit.data.method}-${visit.data.statusCode}-${visit.data.url}`;
    if (map.has(key)) {
        map.get(key).push(visit);
    } else {
        map.set(key, [visit]);
    }
}

const report = async () => {
    const res = await client.query('SELECT * FROM at order by data->>\'statusCode\' desc');
    const map = new Map();
    res.rows.forEach((v) => put(map, v));
    
    let reportContent = '';

    map.forEach((value, key) => {
        reportContent += `# ${key}\n\n`;
        reportContent += '| Timestamp | Host | User-Agent | Referrer |\n';
        reportContent += '|-----------|------|------------|----------|\n';
        const visits = map.get(key);
        visits.forEach(visit => {
            if (`${visit.data.method}-${visit.data.statusCode}-${visit.data.url}` === key) {
                reportContent += `| ${visit.data.timestamp} | ${visit.data.headers? visit.data.headers.host : '-'} | ${visit.data.headers? visit.data.headers['user-agent'] : '-'} | ${visit.data.headers? visit.data.headers.referrer || visit.data.headers.referer: '-'} |\n`;
            }
        });
        reportContent += '\n';
    });
    console.log('Reporting ' + map.size + ' visits');

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir);
    }
    const date = new Date().toISOString().split('T')[0];
    const filename = `report-${date}.html`;
    converter = new showdown.Converter();
    converter.setOption('tables', true);
    html      = first + converter.makeHtml(reportContent) + after;
    fs.writeFileSync(path.join(reportsDir, filename), html);
    
    client.end();
}

client.connect()
    .then(() => report())
    .catch(err => console.error('Connection error', err.stack));