/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createPartFromUri, FileState, GoogleGenAI } from '@google/genai';
import { setTimeout } from 'node:timers/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import glob from 'fast-glob';
import assert from 'node:assert';
import { Bar } from 'cli-progress';
import { randomUUID } from 'node:crypto';
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_API_KEY } from './consts.js';
import { Spinner } from '../utils/spinner.js';
import { Log } from '../utils/logging.js';
/** Yargs command builder for the command. */
function builder(argv) {
    return argv
        .positional('files', {
        description: `One or more glob patterns to find target files (e.g., 'src/**/*.ts' 'test/**/*.ts').`,
        type: 'string',
        array: true,
        demandOption: true,
    })
        .option('error', {
        alias: 'e',
        description: 'Full error description from the build process',
        type: 'string',
        demandOption: true,
    })
        .option('model', {
        type: 'string',
        alias: 'm',
        description: 'Model to use for the migration',
        default: DEFAULT_MODEL,
    })
        .option('temperature', {
        type: 'number',
        alias: 't',
        default: DEFAULT_TEMPERATURE,
        description: 'Temperature for the model. Lower temperature reduces randomness/creativity',
    })
        .option('apiKey', {
        type: 'string',
        alias: 'a',
        default: DEFAULT_API_KEY,
        description: 'API key used when making calls to the Gemini API',
    });
}
/** Yargs command handler for the command. */
async function handler(options) {
    const apiKey = options.apiKey || DEFAULT_API_KEY;
    assert(apiKey, [
        'No API key configured. A Gemini API key must be set as the `GEMINI_API_KEY` environment ' +
            'variable, or passed in using the `--api-key` flag.',
        'For internal users, see go/aistudio-apikey',
    ].join('\n'));
    const fixedContents = await fixFilesWithAI(apiKey, options.files, options.error, options.model, options.temperature);
    Log.info('\n--- AI Suggested Fixes Summary ---');
    if (fixedContents.length === 0) {
        Log.info('No files were fixed or found matching the pattern. Check your glob pattern and check whether the files exist.');
        return;
    }
    Log.info('Updated files:');
    const writeTasks = fixedContents.map(({ filePath, content }) => writeFile(filePath, content).then(() => Log.info(` - ${filePath}`)));
    await Promise.all(writeTasks);
}
async function fixFilesWithAI(apiKey, globPatterns, errorDescription, model, temperature) {
    const filePaths = await glob(globPatterns, {
        onlyFiles: true,
        absolute: false,
    });
    if (filePaths.length === 0) {
        Log.error(`No files found matching the patterns: ${JSON.stringify(globPatterns, null, 2)}.`);
        return [];
    }
    const ai = new GoogleGenAI({ vertexai: false, apiKey });
    let uploadedFileNames = [];
    const progressBar = new Bar({
        format: `{step} [{bar}] ETA: {eta}s | {value}/{total} files`,
        clearOnComplete: true,
    });
    try {
        const { fileNameMap, partsForGeneration, uploadedFileNames: uploadedFiles, } = await uploadFiles(ai, filePaths, progressBar);
        uploadedFileNames = uploadedFiles;
        const spinner = new Spinner('AI is analyzing the files and generating potential fixes...');
        const response = await ai.models.generateContent({
            model,
            contents: [{ text: generatePrompt(errorDescription, fileNameMap) }, ...partsForGeneration],
            config: {
                responseMimeType: 'application/json',
                candidateCount: 1,
                maxOutputTokens: Infinity,
                temperature,
            },
        });
        const responseText = response.text;
        if (!responseText) {
            spinner.failure(`AI returned an empty response.`);
            return [];
        }
        const fixes = JSON.parse(responseText);
        if (!Array.isArray(fixes)) {
            throw new Error('AI response is not a JSON array.');
        }
        spinner.complete();
        return fixes;
    }
    finally {
        if (uploadedFileNames.length) {
            progressBar.start(uploadedFileNames.length, 0, {
                step: 'Deleting temporary uploaded files',
            });
            const deleteTasks = uploadedFileNames.map((name) => {
                return ai.files
                    .delete({ name })
                    .catch((error) => Log.warn(`WARNING: Failed to delete temporary file ${name}:`, error))
                    .finally(() => progressBar.increment());
            });
            await Promise.allSettled(deleteTasks).finally(() => progressBar.stop());
        }
    }
}
async function uploadFiles(ai, filePaths, progressBar) {
    const uploadedFileNames = [];
    const partsForGeneration = [];
    const fileNameMap = new Map();
    progressBar.start(filePaths.length, 0, { step: 'Uploading files' });
    const uploadPromises = filePaths.map(async (filePath) => {
        try {
            const uploadedFile = await ai.files.upload({
                file: new Blob([await readFile(filePath, { encoding: 'utf8' })], {
                    type: 'text/plain',
                }),
                config: {
                    displayName: `fix_request_${basename(filePath)}_${randomUUID()}`,
                },
            });
            assert(uploadedFile.name, 'File name cannot be undefined after upload.');
            let getFile = await ai.files.get({ name: uploadedFile.name });
            while (getFile.state === FileState.PROCESSING) {
                await setTimeout(500); // Wait for 500ms before re-checking
                getFile = await ai.files.get({ name: uploadedFile.name });
            }
            if (getFile.state === FileState.FAILED) {
                throw new Error(`File processing failed on API for ${filePath}. Skipping this file.`);
            }
            if (getFile.uri && getFile.mimeType) {
                const filePart = createPartFromUri(getFile.uri, getFile.mimeType);
                partsForGeneration.push(filePart);
                fileNameMap.set(filePath, uploadedFile.name);
                progressBar.increment();
                return uploadedFile.name; // Return the name on success
            }
            else {
                throw new Error(`Uploaded file for ${filePath} is missing URI or MIME type after processing. Skipping.`);
            }
        }
        catch (error) {
            Log.error(`Error uploading or processing file ${filePath}: ${error.message}`);
            return null; // Indicate failure for this specific file
        }
    });
    const results = await Promise.allSettled(uploadPromises).finally(() => progressBar.stop());
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value !== null) {
            uploadedFileNames.push(result.value);
        }
    }
    return { uploadedFileNames, fileNameMap, partsForGeneration };
}
function generatePrompt(errorDescription, fileNameMap) {
    return `
    You are a highly skilled software engineer, specializing in Bazel, Starlark, Python, Angular, JavaScript,
    TypeScript, and everything related.
    The following files are part of a build process that failed with the error:
    \`\`\`
    ${errorDescription}
    \`\`\`
    Please analyze the content of EACH provided file and suggest modifications to resolve the issue.

    Your response MUST be a JSON array of objects. Each object in the array MUST have two properties:
    'filePath' (the full path from the mappings provided.) and 'content' (the complete corrected content of that file).
    DO NOT include any additional text, non modified files, commentary, or markdown outside the JSON array.
    For example:
    [
      {"filePath": "/full-path-from-mappings/file1.txt", "content": "Corrected content for file1."},
      {"filePath": "/full-path-from-mappings/file2.js", "content": "console.log('Fixed JS');"}
    ]

    IMPORTANT: The input files are mapped as follows: ${Array.from(fileNameMap.entries())}
`;
}
/** CLI command module. */
export const FixModule = {
    builder,
    handler,
    command: 'fix <files..>',
    describe: 'Fixes errors from the specified error output',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L2FpL2ZpeC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBTyxNQUFNLGVBQWUsQ0FBQztBQUM5RSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDaEQsT0FBTyxFQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNyRCxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ25DLE9BQU8sSUFBSSxNQUFNLFdBQVcsQ0FBQztBQUM3QixPQUFPLE1BQU0sTUFBTSxhQUFhLENBQUM7QUFDakMsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxhQUFhLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUF5QnhDLDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSTtTQUNSLFVBQVUsQ0FBQyxPQUFPLEVBQUU7UUFDbkIsV0FBVyxFQUFFLHNGQUFzRjtRQUNuRyxJQUFJLEVBQUUsUUFBUTtRQUNkLEtBQUssRUFBRSxJQUFJO1FBQ1gsWUFBWSxFQUFFLElBQUk7S0FDbkIsQ0FBQztTQUNELE1BQU0sQ0FBQyxPQUFPLEVBQUU7UUFDZixLQUFLLEVBQUUsR0FBRztRQUNWLFdBQVcsRUFBRSwrQ0FBK0M7UUFDNUQsSUFBSSxFQUFFLFFBQVE7UUFDZCxZQUFZLEVBQUUsSUFBSTtLQUNuQixDQUFDO1NBQ0QsTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUNmLElBQUksRUFBRSxRQUFRO1FBQ2QsS0FBSyxFQUFFLEdBQUc7UUFDVixXQUFXLEVBQUUsZ0NBQWdDO1FBQzdDLE9BQU8sRUFBRSxhQUFhO0tBQ3ZCLENBQUM7U0FDRCxNQUFNLENBQUMsYUFBYSxFQUFFO1FBQ3JCLElBQUksRUFBRSxRQUFRO1FBQ2QsS0FBSyxFQUFFLEdBQUc7UUFDVixPQUFPLEVBQUUsbUJBQW1CO1FBQzVCLFdBQVcsRUFBRSw0RUFBNEU7S0FDMUYsQ0FBQztTQUNELE1BQU0sQ0FBQyxRQUFRLEVBQUU7UUFDaEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxLQUFLLEVBQUUsR0FBRztRQUNWLE9BQU8sRUFBRSxlQUFlO1FBQ3hCLFdBQVcsRUFBRSxrREFBa0Q7S0FDaEUsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELDZDQUE2QztBQUM3QyxLQUFLLFVBQVUsT0FBTyxDQUFDLE9BQTJCO0lBQ2hELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLElBQUksZUFBZSxDQUFDO0lBRWpELE1BQU0sQ0FDSixNQUFNLEVBQ047UUFDRSwwRkFBMEY7WUFDeEYsb0RBQW9EO1FBQ3RELDRDQUE0QztLQUM3QyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FDYixDQUFDO0lBRUYsTUFBTSxhQUFhLEdBQUcsTUFBTSxjQUFjLENBQ3hDLE1BQU0sRUFDTixPQUFPLENBQUMsS0FBSyxFQUNiLE9BQU8sQ0FBQyxLQUFLLEVBQ2IsT0FBTyxDQUFDLEtBQUssRUFDYixPQUFPLENBQUMsV0FBVyxDQUNwQixDQUFDO0lBQ0YsR0FBRyxDQUFDLElBQUksQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0lBQ2pELElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUMvQixHQUFHLENBQUMsSUFBSSxDQUNOLCtHQUErRyxDQUNoSCxDQUFDO1FBRUYsT0FBTztJQUNULENBQUM7SUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDM0IsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUMsUUFBUSxFQUFFLE9BQU8sRUFBQyxFQUFFLEVBQUUsQ0FDM0QsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FDcEUsQ0FBQztJQUNGLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQsS0FBSyxVQUFVLGNBQWMsQ0FDM0IsTUFBYyxFQUNkLFlBQXNCLEVBQ3RCLGdCQUF3QixFQUN4QixLQUFhLEVBQ2IsV0FBbUI7SUFFbkIsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ3pDLFNBQVMsRUFBRSxJQUFJO1FBQ2YsUUFBUSxFQUFFLEtBQUs7S0FDaEIsQ0FBQyxDQUFDO0lBRUgsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzNCLEdBQUcsQ0FBQyxLQUFLLENBQUMseUNBQXlDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0YsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0lBRUQsTUFBTSxFQUFFLEdBQUcsSUFBSSxXQUFXLENBQUMsRUFBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxpQkFBaUIsR0FBYSxFQUFFLENBQUM7SUFFckMsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUM7UUFDMUIsTUFBTSxFQUFFLG9EQUFvRDtRQUM1RCxlQUFlLEVBQUUsSUFBSTtLQUN0QixDQUFDLENBQUM7SUFFSCxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQ0osV0FBVyxFQUNYLGtCQUFrQixFQUNsQixpQkFBaUIsRUFBRSxhQUFhLEdBQ2pDLEdBQUcsTUFBTSxXQUFXLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUVsRCxpQkFBaUIsR0FBRyxhQUFhLENBQUM7UUFFbEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsNkRBQTZELENBQUMsQ0FBQztRQUMzRixNQUFNLFFBQVEsR0FBRyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO1lBQy9DLEtBQUs7WUFDTCxRQUFRLEVBQUUsQ0FBQyxFQUFDLElBQUksRUFBRSxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLEVBQUMsRUFBRSxHQUFHLGtCQUFrQixDQUFDO1lBQ3hGLE1BQU0sRUFBRTtnQkFDTixnQkFBZ0IsRUFBRSxrQkFBa0I7Z0JBQ3BDLGNBQWMsRUFBRSxDQUFDO2dCQUNqQixlQUFlLEVBQUUsUUFBUTtnQkFDekIsV0FBVzthQUNaO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztRQUNuQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbEIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQ2xELE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUF1QixDQUFDO1FBRTdELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFRCxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbkIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO1lBQVMsQ0FBQztRQUNULElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsV0FBVyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFO2dCQUM3QyxJQUFJLEVBQUUsbUNBQW1DO2FBQzFDLENBQUMsQ0FBQztZQUNILE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNqRCxPQUFPLEVBQUUsQ0FBQyxLQUFLO3FCQUNaLE1BQU0sQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDO3FCQUNkLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyw0Q0FBNEMsSUFBSSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7cUJBQ3RGLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUM1QyxDQUFDLENBQUMsQ0FBQztZQUVILE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDMUUsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQsS0FBSyxVQUFVLFdBQVcsQ0FDeEIsRUFBZSxFQUNmLFNBQW1CLEVBQ25CLFdBQWdCO0lBTWhCLE1BQU0saUJBQWlCLEdBQWEsRUFBRSxDQUFDO0lBQ3ZDLE1BQU0sa0JBQWtCLEdBQVcsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBRTlDLFdBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUMsQ0FBQyxDQUFDO0lBRWxFLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO1FBQ3RELElBQUksQ0FBQztZQUNILE1BQU0sWUFBWSxHQUFHLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQ3pDLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDLEVBQUU7b0JBQzdELElBQUksRUFBRSxZQUFZO2lCQUNuQixDQUFDO2dCQUNGLE1BQU0sRUFBRTtvQkFDTixXQUFXLEVBQUUsZUFBZSxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxFQUFFLEVBQUU7aUJBQ2pFO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsNkNBQTZDLENBQUMsQ0FBQztZQUV6RSxJQUFJLE9BQU8sR0FBRyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDO1lBQzVELE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQzlDLE1BQU0sVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsb0NBQW9DO2dCQUMzRCxPQUFPLEdBQUcsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFDLElBQUksRUFBRSxZQUFZLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQztZQUMxRCxDQUFDO1lBRUQsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsUUFBUSx1QkFBdUIsQ0FBQyxDQUFDO1lBQ3hGLENBQUM7WUFFRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNwQyxNQUFNLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEUsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNsQyxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDeEIsT0FBTyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsNkJBQTZCO1lBQ3pELENBQUM7aUJBQU0sQ0FBQztnQkFDTixNQUFNLElBQUksS0FBSyxDQUNiLHFCQUFxQixRQUFRLDBEQUEwRCxDQUN4RixDQUFDO1lBQ0osQ0FBQztRQUNILENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ3BCLEdBQUcsQ0FBQyxLQUFLLENBQUMsc0NBQXNDLFFBQVEsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUM5RSxPQUFPLElBQUksQ0FBQyxDQUFDLDBDQUEwQztRQUN6RCxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRTNGLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFLENBQUM7UUFDN0IsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFdBQVcsSUFBSSxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzNELGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkMsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFDLENBQUM7QUFDOUQsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLGdCQUF3QixFQUFFLFdBQWdDO0lBQ2hGLE9BQU87Ozs7O01BS0gsZ0JBQWdCOzs7Ozs7Ozs7Ozs7O3dEQWFrQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztDQUN4RixDQUFDO0FBQ0YsQ0FBQztBQUVELDBCQUEwQjtBQUMxQixNQUFNLENBQUMsTUFBTSxTQUFTLEdBQStCO0lBQ25ELE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLGVBQWU7SUFDeEIsUUFBUSxFQUFFLDhDQUE4QztDQUN6RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y3JlYXRlUGFydEZyb21VcmksIEZpbGVTdGF0ZSwgR29vZ2xlR2VuQUksIFBhcnR9IGZyb20gJ0Bnb29nbGUvZ2VuYWknO1xuaW1wb3J0IHtzZXRUaW1lb3V0fSBmcm9tICdub2RlOnRpbWVycy9wcm9taXNlcyc7XG5pbXBvcnQge3JlYWRGaWxlLCB3cml0ZUZpbGV9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHtiYXNlbmFtZX0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCBnbG9iIGZyb20gJ2Zhc3QtZ2xvYic7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7QmFyfSBmcm9tICdjbGktcHJvZ3Jlc3MnO1xuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7cmFuZG9tVVVJRH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHtERUZBVUxUX01PREVMLCBERUZBVUxUX1RFTVBFUkFUVVJFLCBERUZBVUxUX0FQSV9LRVl9IGZyb20gJy4vY29uc3RzLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbi8qKiBDb21tYW5kIGxpbmUgb3B0aW9ucy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW9ucyB7XG4gIC8qKiBGaWxlcyB0aGF0IHRoZSBmaXggc2hvdWxkIGFwcGx5IHRvLiAqL1xuICBmaWxlczogc3RyaW5nW107XG5cbiAgLyoqIEVycm9yIG1lc3NhZ2UocykgdG8gYmUgcmVzb2x2ZWQuICovXG4gIGVycm9yOiBzdHJpbmc7XG5cbiAgLyoqIE1vZGVsIHRoYXQgc2hvdWxkIGJlIHVzZWQgdG8gYXBwbHkgdGhlIHByb21wdC4gKi9cbiAgbW9kZWw6IHN0cmluZztcblxuICAvKiogVGVtcGVyYXR1cmUgZm9yIHRoZSBtb2RlbC4gKi9cbiAgdGVtcGVyYXR1cmU6IG51bWJlcjtcblxuICAvKiogQVBJIGtleSB0byB1c2Ugd2hlbiBtYWtpbmcgcmVxdWVzdHMuICovXG4gIGFwaUtleT86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEZpeGVkRmlsZUNvbnRlbnQge1xuICBmaWxlUGF0aDogc3RyaW5nO1xuICBjb250ZW50OiBzdHJpbmc7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGJ1aWxkZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcihhcmd2OiBBcmd2KTogQXJndjxPcHRpb25zPiB7XG4gIHJldHVybiBhcmd2XG4gICAgLnBvc2l0aW9uYWwoJ2ZpbGVzJywge1xuICAgICAgZGVzY3JpcHRpb246IGBPbmUgb3IgbW9yZSBnbG9iIHBhdHRlcm5zIHRvIGZpbmQgdGFyZ2V0IGZpbGVzIChlLmcuLCAnc3JjLyoqLyoudHMnICd0ZXN0LyoqLyoudHMnKS5gLFxuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBhcnJheTogdHJ1ZSxcbiAgICAgIGRlbWFuZE9wdGlvbjogdHJ1ZSxcbiAgICB9KVxuICAgIC5vcHRpb24oJ2Vycm9yJywge1xuICAgICAgYWxpYXM6ICdlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRnVsbCBlcnJvciBkZXNjcmlwdGlvbiBmcm9tIHRoZSBidWlsZCBwcm9jZXNzJyxcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZGVtYW5kT3B0aW9uOiB0cnVlLFxuICAgIH0pXG4gICAgLm9wdGlvbignbW9kZWwnLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGFsaWFzOiAnbScsXG4gICAgICBkZXNjcmlwdGlvbjogJ01vZGVsIHRvIHVzZSBmb3IgdGhlIG1pZ3JhdGlvbicsXG4gICAgICBkZWZhdWx0OiBERUZBVUxUX01PREVMLFxuICAgIH0pXG4gICAgLm9wdGlvbigndGVtcGVyYXR1cmUnLCB7XG4gICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgIGFsaWFzOiAndCcsXG4gICAgICBkZWZhdWx0OiBERUZBVUxUX1RFTVBFUkFUVVJFLFxuICAgICAgZGVzY3JpcHRpb246ICdUZW1wZXJhdHVyZSBmb3IgdGhlIG1vZGVsLiBMb3dlciB0ZW1wZXJhdHVyZSByZWR1Y2VzIHJhbmRvbW5lc3MvY3JlYXRpdml0eScsXG4gICAgfSlcbiAgICAub3B0aW9uKCdhcGlLZXknLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGFsaWFzOiAnYScsXG4gICAgICBkZWZhdWx0OiBERUZBVUxUX0FQSV9LRVksXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBrZXkgdXNlZCB3aGVuIG1ha2luZyBjYWxscyB0byB0aGUgR2VtaW5pIEFQSScsXG4gICAgfSk7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGhhbmRsZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihvcHRpb25zOiBBcmd1bWVudHM8T3B0aW9ucz4pIHtcbiAgY29uc3QgYXBpS2V5ID0gb3B0aW9ucy5hcGlLZXkgfHwgREVGQVVMVF9BUElfS0VZO1xuXG4gIGFzc2VydChcbiAgICBhcGlLZXksXG4gICAgW1xuICAgICAgJ05vIEFQSSBrZXkgY29uZmlndXJlZC4gQSBHZW1pbmkgQVBJIGtleSBtdXN0IGJlIHNldCBhcyB0aGUgYEdFTUlOSV9BUElfS0VZYCBlbnZpcm9ubWVudCAnICtcbiAgICAgICAgJ3ZhcmlhYmxlLCBvciBwYXNzZWQgaW4gdXNpbmcgdGhlIGAtLWFwaS1rZXlgIGZsYWcuJyxcbiAgICAgICdGb3IgaW50ZXJuYWwgdXNlcnMsIHNlZSBnby9haXN0dWRpby1hcGlrZXknLFxuICAgIF0uam9pbignXFxuJyksXG4gICk7XG5cbiAgY29uc3QgZml4ZWRDb250ZW50cyA9IGF3YWl0IGZpeEZpbGVzV2l0aEFJKFxuICAgIGFwaUtleSxcbiAgICBvcHRpb25zLmZpbGVzLFxuICAgIG9wdGlvbnMuZXJyb3IsXG4gICAgb3B0aW9ucy5tb2RlbCxcbiAgICBvcHRpb25zLnRlbXBlcmF0dXJlLFxuICApO1xuICBMb2cuaW5mbygnXFxuLS0tIEFJIFN1Z2dlc3RlZCBGaXhlcyBTdW1tYXJ5IC0tLScpO1xuICBpZiAoZml4ZWRDb250ZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBMb2cuaW5mbyhcbiAgICAgICdObyBmaWxlcyB3ZXJlIGZpeGVkIG9yIGZvdW5kIG1hdGNoaW5nIHRoZSBwYXR0ZXJuLiBDaGVjayB5b3VyIGdsb2IgcGF0dGVybiBhbmQgY2hlY2sgd2hldGhlciB0aGUgZmlsZXMgZXhpc3QuJyxcbiAgICApO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgTG9nLmluZm8oJ1VwZGF0ZWQgZmlsZXM6Jyk7XG4gIGNvbnN0IHdyaXRlVGFza3MgPSBmaXhlZENvbnRlbnRzLm1hcCgoe2ZpbGVQYXRoLCBjb250ZW50fSkgPT5cbiAgICB3cml0ZUZpbGUoZmlsZVBhdGgsIGNvbnRlbnQpLnRoZW4oKCkgPT4gTG9nLmluZm8oYCAtICR7ZmlsZVBhdGh9YCkpLFxuICApO1xuICBhd2FpdCBQcm9taXNlLmFsbCh3cml0ZVRhc2tzKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZml4RmlsZXNXaXRoQUkoXG4gIGFwaUtleTogc3RyaW5nLFxuICBnbG9iUGF0dGVybnM6IHN0cmluZ1tdLFxuICBlcnJvckRlc2NyaXB0aW9uOiBzdHJpbmcsXG4gIG1vZGVsOiBzdHJpbmcsXG4gIHRlbXBlcmF0dXJlOiBudW1iZXIsXG4pOiBQcm9taXNlPEZpeGVkRmlsZUNvbnRlbnRbXT4ge1xuICBjb25zdCBmaWxlUGF0aHMgPSBhd2FpdCBnbG9iKGdsb2JQYXR0ZXJucywge1xuICAgIG9ubHlGaWxlczogdHJ1ZSxcbiAgICBhYnNvbHV0ZTogZmFsc2UsXG4gIH0pO1xuXG4gIGlmIChmaWxlUGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgTG9nLmVycm9yKGBObyBmaWxlcyBmb3VuZCBtYXRjaGluZyB0aGUgcGF0dGVybnM6ICR7SlNPTi5zdHJpbmdpZnkoZ2xvYlBhdHRlcm5zLCBudWxsLCAyKX0uYCk7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgY29uc3QgYWkgPSBuZXcgR29vZ2xlR2VuQUkoe3ZlcnRleGFpOiBmYWxzZSwgYXBpS2V5fSk7XG4gIGxldCB1cGxvYWRlZEZpbGVOYW1lczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdCBwcm9ncmVzc0JhciA9IG5ldyBCYXIoe1xuICAgIGZvcm1hdDogYHtzdGVwfSBbe2Jhcn1dIEVUQToge2V0YX1zIHwge3ZhbHVlfS97dG90YWx9IGZpbGVzYCxcbiAgICBjbGVhck9uQ29tcGxldGU6IHRydWUsXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3Qge1xuICAgICAgZmlsZU5hbWVNYXAsXG4gICAgICBwYXJ0c0ZvckdlbmVyYXRpb24sXG4gICAgICB1cGxvYWRlZEZpbGVOYW1lczogdXBsb2FkZWRGaWxlcyxcbiAgICB9ID0gYXdhaXQgdXBsb2FkRmlsZXMoYWksIGZpbGVQYXRocywgcHJvZ3Jlc3NCYXIpO1xuXG4gICAgdXBsb2FkZWRGaWxlTmFtZXMgPSB1cGxvYWRlZEZpbGVzO1xuXG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdBSSBpcyBhbmFseXppbmcgdGhlIGZpbGVzIGFuZCBnZW5lcmF0aW5nIHBvdGVudGlhbCBmaXhlcy4uLicpO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYWkubW9kZWxzLmdlbmVyYXRlQ29udGVudCh7XG4gICAgICBtb2RlbCxcbiAgICAgIGNvbnRlbnRzOiBbe3RleHQ6IGdlbmVyYXRlUHJvbXB0KGVycm9yRGVzY3JpcHRpb24sIGZpbGVOYW1lTWFwKX0sIC4uLnBhcnRzRm9yR2VuZXJhdGlvbl0sXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgcmVzcG9uc2VNaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBjYW5kaWRhdGVDb3VudDogMSxcbiAgICAgICAgbWF4T3V0cHV0VG9rZW5zOiBJbmZpbml0eSxcbiAgICAgICAgdGVtcGVyYXR1cmUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzcG9uc2VUZXh0ID0gcmVzcG9uc2UudGV4dDtcbiAgICBpZiAoIXJlc3BvbnNlVGV4dCkge1xuICAgICAgc3Bpbm5lci5mYWlsdXJlKGBBSSByZXR1cm5lZCBhbiBlbXB0eSByZXNwb25zZS5gKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBmaXhlcyA9IEpTT04ucGFyc2UocmVzcG9uc2VUZXh0KSBhcyBGaXhlZEZpbGVDb250ZW50W107XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZml4ZXMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FJIHJlc3BvbnNlIGlzIG5vdCBhIEpTT04gYXJyYXkuJyk7XG4gICAgfVxuXG4gICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgIHJldHVybiBmaXhlcztcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAodXBsb2FkZWRGaWxlTmFtZXMubGVuZ3RoKSB7XG4gICAgICBwcm9ncmVzc0Jhci5zdGFydCh1cGxvYWRlZEZpbGVOYW1lcy5sZW5ndGgsIDAsIHtcbiAgICAgICAgc3RlcDogJ0RlbGV0aW5nIHRlbXBvcmFyeSB1cGxvYWRlZCBmaWxlcycsXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGRlbGV0ZVRhc2tzID0gdXBsb2FkZWRGaWxlTmFtZXMubWFwKChuYW1lKSA9PiB7XG4gICAgICAgIHJldHVybiBhaS5maWxlc1xuICAgICAgICAgIC5kZWxldGUoe25hbWV9KVxuICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IExvZy53YXJuKGBXQVJOSU5HOiBGYWlsZWQgdG8gZGVsZXRlIHRlbXBvcmFyeSBmaWxlICR7bmFtZX06YCwgZXJyb3IpKVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHByb2dyZXNzQmFyLmluY3JlbWVudCgpKTtcbiAgICAgIH0pO1xuXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoZGVsZXRlVGFza3MpLmZpbmFsbHkoKCkgPT4gcHJvZ3Jlc3NCYXIuc3RvcCgpKTtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBsb2FkRmlsZXMoXG4gIGFpOiBHb29nbGVHZW5BSSxcbiAgZmlsZVBhdGhzOiBzdHJpbmdbXSxcbiAgcHJvZ3Jlc3NCYXI6IEJhcixcbik6IFByb21pc2U8e1xuICB1cGxvYWRlZEZpbGVOYW1lczogc3RyaW5nW107XG4gIHBhcnRzRm9yR2VuZXJhdGlvbjogUGFydFtdO1xuICBmaWxlTmFtZU1hcDogTWFwPHN0cmluZywgc3RyaW5nPjtcbn0+IHtcbiAgY29uc3QgdXBsb2FkZWRGaWxlTmFtZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHBhcnRzRm9yR2VuZXJhdGlvbjogUGFydFtdID0gW107XG4gIGNvbnN0IGZpbGVOYW1lTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICBwcm9ncmVzc0Jhci5zdGFydChmaWxlUGF0aHMubGVuZ3RoLCAwLCB7c3RlcDogJ1VwbG9hZGluZyBmaWxlcyd9KTtcblxuICBjb25zdCB1cGxvYWRQcm9taXNlcyA9IGZpbGVQYXRocy5tYXAoYXN5bmMgKGZpbGVQYXRoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVwbG9hZGVkRmlsZSA9IGF3YWl0IGFpLmZpbGVzLnVwbG9hZCh7XG4gICAgICAgIGZpbGU6IG5ldyBCbG9iKFthd2FpdCByZWFkRmlsZShmaWxlUGF0aCwge2VuY29kaW5nOiAndXRmOCd9KV0sIHtcbiAgICAgICAgICB0eXBlOiAndGV4dC9wbGFpbicsXG4gICAgICAgIH0pLFxuICAgICAgICBjb25maWc6IHtcbiAgICAgICAgICBkaXNwbGF5TmFtZTogYGZpeF9yZXF1ZXN0XyR7YmFzZW5hbWUoZmlsZVBhdGgpfV8ke3JhbmRvbVVVSUQoKX1gLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGFzc2VydCh1cGxvYWRlZEZpbGUubmFtZSwgJ0ZpbGUgbmFtZSBjYW5ub3QgYmUgdW5kZWZpbmVkIGFmdGVyIHVwbG9hZC4nKTtcblxuICAgICAgbGV0IGdldEZpbGUgPSBhd2FpdCBhaS5maWxlcy5nZXQoe25hbWU6IHVwbG9hZGVkRmlsZS5uYW1lfSk7XG4gICAgICB3aGlsZSAoZ2V0RmlsZS5zdGF0ZSA9PT0gRmlsZVN0YXRlLlBST0NFU1NJTkcpIHtcbiAgICAgICAgYXdhaXQgc2V0VGltZW91dCg1MDApOyAvLyBXYWl0IGZvciA1MDBtcyBiZWZvcmUgcmUtY2hlY2tpbmdcbiAgICAgICAgZ2V0RmlsZSA9IGF3YWl0IGFpLmZpbGVzLmdldCh7bmFtZTogdXBsb2FkZWRGaWxlLm5hbWV9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdldEZpbGUuc3RhdGUgPT09IEZpbGVTdGF0ZS5GQUlMRUQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGaWxlIHByb2Nlc3NpbmcgZmFpbGVkIG9uIEFQSSBmb3IgJHtmaWxlUGF0aH0uIFNraXBwaW5nIHRoaXMgZmlsZS5gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdldEZpbGUudXJpICYmIGdldEZpbGUubWltZVR5cGUpIHtcbiAgICAgICAgY29uc3QgZmlsZVBhcnQgPSBjcmVhdGVQYXJ0RnJvbVVyaShnZXRGaWxlLnVyaSwgZ2V0RmlsZS5taW1lVHlwZSk7XG4gICAgICAgIHBhcnRzRm9yR2VuZXJhdGlvbi5wdXNoKGZpbGVQYXJ0KTtcbiAgICAgICAgZmlsZU5hbWVNYXAuc2V0KGZpbGVQYXRoLCB1cGxvYWRlZEZpbGUubmFtZSk7XG4gICAgICAgIHByb2dyZXNzQmFyLmluY3JlbWVudCgpO1xuICAgICAgICByZXR1cm4gdXBsb2FkZWRGaWxlLm5hbWU7IC8vIFJldHVybiB0aGUgbmFtZSBvbiBzdWNjZXNzXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFVwbG9hZGVkIGZpbGUgZm9yICR7ZmlsZVBhdGh9IGlzIG1pc3NpbmcgVVJJIG9yIE1JTUUgdHlwZSBhZnRlciBwcm9jZXNzaW5nLiBTa2lwcGluZy5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIExvZy5lcnJvcihgRXJyb3IgdXBsb2FkaW5nIG9yIHByb2Nlc3NpbmcgZmlsZSAke2ZpbGVQYXRofTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgcmV0dXJuIG51bGw7IC8vIEluZGljYXRlIGZhaWx1cmUgZm9yIHRoaXMgc3BlY2lmaWMgZmlsZVxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZCh1cGxvYWRQcm9taXNlcykuZmluYWxseSgoKSA9PiBwcm9ncmVzc0Jhci5zdG9wKCkpO1xuXG4gIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgcmVzdWx0LnZhbHVlICE9PSBudWxsKSB7XG4gICAgICB1cGxvYWRlZEZpbGVOYW1lcy5wdXNoKHJlc3VsdC52YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHt1cGxvYWRlZEZpbGVOYW1lcywgZmlsZU5hbWVNYXAsIHBhcnRzRm9yR2VuZXJhdGlvbn07XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlUHJvbXB0KGVycm9yRGVzY3JpcHRpb246IHN0cmluZywgZmlsZU5hbWVNYXA6IE1hcDxzdHJpbmcsIHN0cmluZz4pOiBzdHJpbmcge1xuICByZXR1cm4gYFxuICAgIFlvdSBhcmUgYSBoaWdobHkgc2tpbGxlZCBzb2Z0d2FyZSBlbmdpbmVlciwgc3BlY2lhbGl6aW5nIGluIEJhemVsLCBTdGFybGFyaywgUHl0aG9uLCBBbmd1bGFyLCBKYXZhU2NyaXB0LFxuICAgIFR5cGVTY3JpcHQsIGFuZCBldmVyeXRoaW5nIHJlbGF0ZWQuXG4gICAgVGhlIGZvbGxvd2luZyBmaWxlcyBhcmUgcGFydCBvZiBhIGJ1aWxkIHByb2Nlc3MgdGhhdCBmYWlsZWQgd2l0aCB0aGUgZXJyb3I6XG4gICAgXFxgXFxgXFxgXG4gICAgJHtlcnJvckRlc2NyaXB0aW9ufVxuICAgIFxcYFxcYFxcYFxuICAgIFBsZWFzZSBhbmFseXplIHRoZSBjb250ZW50IG9mIEVBQ0ggcHJvdmlkZWQgZmlsZSBhbmQgc3VnZ2VzdCBtb2RpZmljYXRpb25zIHRvIHJlc29sdmUgdGhlIGlzc3VlLlxuXG4gICAgWW91ciByZXNwb25zZSBNVVNUIGJlIGEgSlNPTiBhcnJheSBvZiBvYmplY3RzLiBFYWNoIG9iamVjdCBpbiB0aGUgYXJyYXkgTVVTVCBoYXZlIHR3byBwcm9wZXJ0aWVzOlxuICAgICdmaWxlUGF0aCcgKHRoZSBmdWxsIHBhdGggZnJvbSB0aGUgbWFwcGluZ3MgcHJvdmlkZWQuKSBhbmQgJ2NvbnRlbnQnICh0aGUgY29tcGxldGUgY29ycmVjdGVkIGNvbnRlbnQgb2YgdGhhdCBmaWxlKS5cbiAgICBETyBOT1QgaW5jbHVkZSBhbnkgYWRkaXRpb25hbCB0ZXh0LCBub24gbW9kaWZpZWQgZmlsZXMsIGNvbW1lbnRhcnksIG9yIG1hcmtkb3duIG91dHNpZGUgdGhlIEpTT04gYXJyYXkuXG4gICAgRm9yIGV4YW1wbGU6XG4gICAgW1xuICAgICAge1wiZmlsZVBhdGhcIjogXCIvZnVsbC1wYXRoLWZyb20tbWFwcGluZ3MvZmlsZTEudHh0XCIsIFwiY29udGVudFwiOiBcIkNvcnJlY3RlZCBjb250ZW50IGZvciBmaWxlMS5cIn0sXG4gICAgICB7XCJmaWxlUGF0aFwiOiBcIi9mdWxsLXBhdGgtZnJvbS1tYXBwaW5ncy9maWxlMi5qc1wiLCBcImNvbnRlbnRcIjogXCJjb25zb2xlLmxvZygnRml4ZWQgSlMnKTtcIn1cbiAgICBdXG5cbiAgICBJTVBPUlRBTlQ6IFRoZSBpbnB1dCBmaWxlcyBhcmUgbWFwcGVkIGFzIGZvbGxvd3M6ICR7QXJyYXkuZnJvbShmaWxlTmFtZU1hcC5lbnRyaWVzKCkpfVxuYDtcbn1cblxuLyoqIENMSSBjb21tYW5kIG1vZHVsZS4gKi9cbmV4cG9ydCBjb25zdCBGaXhNb2R1bGU6IENvbW1hbmRNb2R1bGU8e30sIE9wdGlvbnM+ID0ge1xuICBidWlsZGVyLFxuICBoYW5kbGVyLFxuICBjb21tYW5kOiAnZml4IDxmaWxlcy4uPicsXG4gIGRlc2NyaWJlOiAnRml4ZXMgZXJyb3JzIGZyb20gdGhlIHNwZWNpZmllZCBlcnJvciBvdXRwdXQnLFxufTtcbiJdfQ==