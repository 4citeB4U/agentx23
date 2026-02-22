import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaPath = path.resolve('compliance/schemas/leeway-test-report.schema.json');
const reportArg = process.argv[2] || 'compliance/examples/sample-test-report.json';
const reportPath = path.resolve(reportArg);

function readJson(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

try {
    if (!fs.existsSync(schemaPath)) {
        console.error(`[leeway] Schema not found: ${schemaPath}`);
        process.exit(1);
    }

    if (!fs.existsSync(reportPath)) {
        console.error(`[leeway] Report not found: ${reportPath}`);
        process.exit(1);
    }

    const schema = readJson(schemaPath);
    const report = readJson(reportPath);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const valid = validate(report);

    if (!valid) {
        console.error('[leeway] Validation failed.');
        for (const error of validate.errors || []) {
            console.error(`- ${error.instancePath || '/'} ${error.message || 'schema violation'}`);
        }
        process.exit(1);
    }

    console.log(`[leeway] Validation passed: ${reportPath}`);
    process.exit(0);
} catch (error) {
    console.error('[leeway] Validator error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
}
