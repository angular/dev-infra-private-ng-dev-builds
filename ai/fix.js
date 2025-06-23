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
    assert(options.apiKey, [
        'No API key configured. A Gemini API key must be set as the `GEMINI_API_KEY` environment ' +
            'variable, or passed in using the `--api-key` flag.',
        'For internal users, see go/aistudio-apikey',
    ].join('\n'));
    const fixedContents = await fixFilesWithAI(options.apiKey, options.files, options.error, options.model, options.temperature);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L2FpL2ZpeC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBTyxNQUFNLGVBQWUsQ0FBQztBQUM5RSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDaEQsT0FBTyxFQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNyRCxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ25DLE9BQU8sSUFBSSxNQUFNLFdBQVcsQ0FBQztBQUM3QixPQUFPLE1BQU0sTUFBTSxhQUFhLENBQUM7QUFDakMsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUVqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxhQUFhLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUF5QnhDLDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSTtTQUNSLFVBQVUsQ0FBQyxPQUFPLEVBQUU7UUFDbkIsV0FBVyxFQUFFLHNGQUFzRjtRQUNuRyxJQUFJLEVBQUUsUUFBUTtRQUNkLEtBQUssRUFBRSxJQUFJO1FBQ1gsWUFBWSxFQUFFLElBQUk7S0FDbkIsQ0FBQztTQUNELE1BQU0sQ0FBQyxPQUFPLEVBQUU7UUFDZixLQUFLLEVBQUUsR0FBRztRQUNWLFdBQVcsRUFBRSwrQ0FBK0M7UUFDNUQsSUFBSSxFQUFFLFFBQVE7UUFDZCxZQUFZLEVBQUUs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QVMsR0FBK0I7SUFDbkQsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPLEVBQUUsZUFBZTtJQUN4QixRQUFRLEVBQUUsOENBQThDO0NBQ3pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjcmVhdGVQYXJ0RnJvbVVyaSwgRmlsZVN0YXRlLCBHb29nbGVHZW5BSSwgUGFydH0gZnJvbSAnQGdvb2dsZS9nZW5haSc7XG5pbXBvcnQge3NldFRpbWVvdXR9IGZyb20gJ25vZGU6dGltZXJzL3Byb21pc2VzJztcbmltcG9ydCB7cmVhZEZpbGUsIHdyaXRlRmlsZX0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQge2Jhc2VuYW1lfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IGdsb2IgZnJvbSAnZmFzdC1nbG9iJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHtCYXJ9IGZyb20gJ2NsaS1wcm9ncmVzcyc7XG5pbXBvcnQge0FyZ3YsIEFyZ3VtZW50cywgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHtyYW5kb21VVUlEfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQge0RFRkFVTFRfTU9ERUwsIERFRkFVTFRfVEVNUEVSQVRVUkUsIERFRkFVTFRfQVBJX0tFWX0gZnJvbSAnLi9jb25zdHMuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi91dGlscy9sb2dnaW5nLmpzJztcblxuLyoqIENvbW1hbmQgbGluZSBvcHRpb25zLiAqL1xuZXhwb3J0IGludGVyZmFjZSBPcHRpb25zIHtcbiAgLyoqIEZpbGVzIHRoYXQgdGhlIGZpeCBzaG91bGQgYXBwbHkgdG8uICovXG4gIGZpbGVzOiBzdHJpbmdbXTtcblxuICAvKiogRXJyb3IgbWVzc2FnZShzKSB0byBiZSByZXNvbHZlZC4gKi9cbiAgZXJyb3I6IHN0cmluZztcblxuICAvKiogTW9kZWwgdGhhdCBzaG91bGQgYmUgdXNlZCB0byBhcHBseSB0aGUgcHJvbXB0LiAqL1xuICBtb2RlbDogc3RyaW5nO1xuXG4gIC8qKiBUZW1wZXJhdHVyZSBmb3IgdGhlIG1vZGVsLiAqL1xuICB0ZW1wZXJhdHVyZTogbnVtYmVyO1xuXG4gIC8qKiBBUEkga2V5IHRvIHVzZSB3aGVuIG1ha2luZyByZXF1ZXN0cy4gKi9cbiAgYXBpS2V5Pzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgRml4ZWRGaWxlQ29udGVudCB7XG4gIGZpbGVQYXRoOiBzdHJpbmc7XG4gIGNvbnRlbnQ6IHN0cmluZztcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgYnVpbGRlciBmb3IgdGhlIGNvbW1hbmQuICovXG5mdW5jdGlvbiBidWlsZGVyKGFyZ3Y6IEFyZ3YpOiBBcmd2PE9wdGlvbnM+IHtcbiAgcmV0dXJuIGFyZ3ZcbiAgICAucG9zaXRpb25hbCgnZmlsZXMnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYE9uZSBvciBtb3JlIGdsb2IgcGF0dGVybnMgdG8gZmluZCB0YXJnZXQgZmlsZXMgKGUuZy4sICdzcmMvKiovKi50cycgJ3Rlc3QvKiovKi50cycpLmAsXG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGFycmF5OiB0cnVlLFxuICAgICAgZGVtYW5kT3B0aW9uOiB0cnVlLFxuICAgIH0pXG4gICAgLm9wdGlvbignZXJyb3InLCB7XG4gICAgICBhbGlhczogJ2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdGdWxsIGVycm9yIGRlc2NyaXB0aW9uIGZyb20gdGhlIGJ1aWxkIHByb2Nlc3MnLFxuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gICAgfSlcbiAgICAub3B0aW9uKCdtb2RlbCcsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgYWxpYXM6ICdtJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTW9kZWwgdG8gdXNlIGZvciB0aGUgbWlncmF0aW9uJyxcbiAgICAgIGRlZmF1bHQ6IERFRkFVTFRfTU9ERUwsXG4gICAgfSlcbiAgICAub3B0aW9uKCd0ZW1wZXJhdHVyZScsIHtcbiAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgYWxpYXM6ICd0JyxcbiAgICAgIGRlZmF1bHQ6IERFRkFVTFRfVEVNUEVSQVRVUkUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RlbXBlcmF0dXJlIGZvciB0aGUgbW9kZWwuIExvd2VyIHRlbXBlcmF0dXJlIHJlZHVjZXMgcmFuZG9tbmVzcy9jcmVhdGl2aXR5JyxcbiAgICB9KVxuICAgIC5vcHRpb24oJ2FwaUtleScsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgYWxpYXM6ICdhJyxcbiAgICAgIGRlZmF1bHQ6IERFRkFVTFRfQVBJX0tFWSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGtleSB1c2VkIHdoZW4gbWFraW5nIGNhbGxzIHRvIHRoZSBHZW1pbmkgQVBJJyxcbiAgICB9KTtcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgaGFuZGxlciBmb3IgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKG9wdGlvbnM6IEFyZ3VtZW50czxPcHRpb25zPikge1xuICBhc3NlcnQoXG4gICAgb3B0aW9ucy5hcGlLZXksXG4gICAgW1xuICAgICAgJ05vIEFQSSBrZXkgY29uZmlndXJlZC4gQSBHZW1pbmkgQVBJIGtleSBtdXN0IGJlIHNldCBhcyB0aGUgYEdFTUlOSV9BUElfS0VZYCBlbnZpcm9ubWVudCAnICtcbiAgICAgICAgJ3ZhcmlhYmxlLCBvciBwYXNzZWQgaW4gdXNpbmcgdGhlIGAtLWFwaS1rZXlgIGZsYWcuJyxcbiAgICAgICdGb3IgaW50ZXJuYWwgdXNlcnMsIHNlZSBnby9haXN0dWRpby1hcGlrZXknLFxuICAgIF0uam9pbignXFxuJyksXG4gICk7XG5cbiAgY29uc3QgZml4ZWRDb250ZW50cyA9IGF3YWl0IGZpeEZpbGVzV2l0aEFJKFxuICAgIG9wdGlvbnMuYXBpS2V5LFxuICAgIG9wdGlvbnMuZmlsZXMsXG4gICAgb3B0aW9ucy5lcnJvcixcbiAgICBvcHRpb25zLm1vZGVsLFxuICAgIG9wdGlvbnMudGVtcGVyYXR1cmUsXG4gICk7XG4gIExvZy5pbmZvKCdcXG4tLS0gQUkgU3VnZ2VzdGVkIEZpeGVzIFN1bW1hcnkgLS0tJyk7XG4gIGlmIChmaXhlZENvbnRlbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIExvZy5pbmZvKFxuICAgICAgJ05vIGZpbGVzIHdlcmUgZml4ZWQgb3IgZm91bmQgbWF0Y2hpbmcgdGhlIHBhdHRlcm4uIENoZWNrIHlvdXIgZ2xvYiBwYXR0ZXJuIGFuZCBjaGVjayB3aGV0aGVyIHRoZSBmaWxlcyBleGlzdC4nLFxuICAgICk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBMb2cuaW5mbygnVXBkYXRlZCBmaWxlczonKTtcbiAgY29uc3Qgd3JpdGVUYXNrcyA9IGZpeGVkQ29udGVudHMubWFwKCh7ZmlsZVBhdGgsIGNvbnRlbnR9KSA9PlxuICAgIHdyaXRlRmlsZShmaWxlUGF0aCwgY29udGVudCkudGhlbigoKSA9PiBMb2cuaW5mbyhgIC0gJHtmaWxlUGF0aH1gKSksXG4gICk7XG4gIGF3YWl0IFByb21pc2UuYWxsKHdyaXRlVGFza3MpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBmaXhGaWxlc1dpdGhBSShcbiAgYXBpS2V5OiBzdHJpbmcsXG4gIGdsb2JQYXR0ZXJuczogc3RyaW5nW10sXG4gIGVycm9yRGVzY3JpcHRpb246IHN0cmluZyxcbiAgbW9kZWw6IHN0cmluZyxcbiAgdGVtcGVyYXR1cmU6IG51bWJlcixcbik6IFByb21pc2U8Rml4ZWRGaWxlQ29udGVudFtdPiB7XG4gIGNvbnN0IGZpbGVQYXRocyA9IGF3YWl0IGdsb2IoZ2xvYlBhdHRlcm5zLCB7XG4gICAgb25seUZpbGVzOiB0cnVlLFxuICAgIGFic29sdXRlOiBmYWxzZSxcbiAgfSk7XG5cbiAgaWYgKGZpbGVQYXRocy5sZW5ndGggPT09IDApIHtcbiAgICBMb2cuZXJyb3IoYE5vIGZpbGVzIGZvdW5kIG1hdGNoaW5nIHRoZSBwYXR0ZXJuczogJHtKU09OLnN0cmluZ2lmeShnbG9iUGF0dGVybnMsIG51bGwsIDIpfS5gKTtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCBhaSA9IG5ldyBHb29nbGVHZW5BSSh7dmVydGV4YWk6IGZhbHNlLCBhcGlLZXl9KTtcbiAgbGV0IHVwbG9hZGVkRmlsZU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0IHByb2dyZXNzQmFyID0gbmV3IEJhcih7XG4gICAgZm9ybWF0OiBge3N0ZXB9IFt7YmFyfV0gRVRBOiB7ZXRhfXMgfCB7dmFsdWV9L3t0b3RhbH0gZmlsZXNgLFxuICAgIGNsZWFyT25Db21wbGV0ZTogdHJ1ZSxcbiAgfSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7XG4gICAgICBmaWxlTmFtZU1hcCxcbiAgICAgIHBhcnRzRm9yR2VuZXJhdGlvbixcbiAgICAgIHVwbG9hZGVkRmlsZU5hbWVzOiB1cGxvYWRlZEZpbGVzLFxuICAgIH0gPSBhd2FpdCB1cGxvYWRGaWxlcyhhaSwgZmlsZVBhdGhzLCBwcm9ncmVzc0Jhcik7XG5cbiAgICB1cGxvYWRlZEZpbGVOYW1lcyA9IHVwbG9hZGVkRmlsZXM7XG5cbiAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoJ0FJIGlzIGFuYWx5emluZyB0aGUgZmlsZXMgYW5kIGdlbmVyYXRpbmcgcG90ZW50aWFsIGZpeGVzLi4uJyk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhaS5tb2RlbHMuZ2VuZXJhdGVDb250ZW50KHtcbiAgICAgIG1vZGVsLFxuICAgICAgY29udGVudHM6IFt7dGV4dDogZ2VuZXJhdGVQcm9tcHQoZXJyb3JEZXNjcmlwdGlvbiwgZmlsZU5hbWVNYXApfSwgLi4ucGFydHNGb3JHZW5lcmF0aW9uXSxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICByZXNwb25zZU1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGNhbmRpZGF0ZUNvdW50OiAxLFxuICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IEluZmluaXR5LFxuICAgICAgICB0ZW1wZXJhdHVyZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZVRleHQgPSByZXNwb25zZS50ZXh0O1xuICAgIGlmICghcmVzcG9uc2VUZXh0KSB7XG4gICAgICBzcGlubmVyLmZhaWx1cmUoYEFJIHJldHVybmVkIGFuIGVtcHR5IHJlc3BvbnNlLmApO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IGZpeGVzID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIGFzIEZpeGVkRmlsZUNvbnRlbnRbXTtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheShmaXhlcykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQUkgcmVzcG9uc2UgaXMgbm90IGEgSlNPTiBhcnJheS4nKTtcbiAgICB9XG5cbiAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgcmV0dXJuIGZpeGVzO1xuICB9IGZpbmFsbHkge1xuICAgIGlmICh1cGxvYWRlZEZpbGVOYW1lcy5sZW5ndGgpIHtcbiAgICAgIHByb2dyZXNzQmFyLnN0YXJ0KHVwbG9hZGVkRmlsZU5hbWVzLmxlbmd0aCwgMCwge1xuICAgICAgICBzdGVwOiAnRGVsZXRpbmcgdGVtcG9yYXJ5IHVwbG9hZGVkIGZpbGVzJyxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZGVsZXRlVGFza3MgPSB1cGxvYWRlZEZpbGVOYW1lcy5tYXAoKG5hbWUpID0+IHtcbiAgICAgICAgcmV0dXJuIGFpLmZpbGVzXG4gICAgICAgICAgLmRlbGV0ZSh7bmFtZX0pXG4gICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4gTG9nLndhcm4oYFdBUk5JTkc6IEZhaWxlZCB0byBkZWxldGUgdGVtcG9yYXJ5IGZpbGUgJHtuYW1lfTpgLCBlcnJvcikpXG4gICAgICAgICAgLmZpbmFsbHkoKCkgPT4gcHJvZ3Jlc3NCYXIuaW5jcmVtZW50KCkpO1xuICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChkZWxldGVUYXNrcykuZmluYWxseSgoKSA9PiBwcm9ncmVzc0Jhci5zdG9wKCkpO1xuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGxvYWRGaWxlcyhcbiAgYWk6IEdvb2dsZUdlbkFJLFxuICBmaWxlUGF0aHM6IHN0cmluZ1tdLFxuICBwcm9ncmVzc0JhcjogQmFyLFxuKTogUHJvbWlzZTx7XG4gIHVwbG9hZGVkRmlsZU5hbWVzOiBzdHJpbmdbXTtcbiAgcGFydHNGb3JHZW5lcmF0aW9uOiBQYXJ0W107XG4gIGZpbGVOYW1lTWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xufT4ge1xuICBjb25zdCB1cGxvYWRlZEZpbGVOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGFydHNGb3JHZW5lcmF0aW9uOiBQYXJ0W10gPSBbXTtcbiAgY29uc3QgZmlsZU5hbWVNYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIHByb2dyZXNzQmFyLnN0YXJ0KGZpbGVQYXRocy5sZW5ndGgsIDAsIHtzdGVwOiAnVXBsb2FkaW5nIGZpbGVzJ30pO1xuXG4gIGNvbnN0IHVwbG9hZFByb21pc2VzID0gZmlsZVBhdGhzLm1hcChhc3luYyAoZmlsZVBhdGgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXBsb2FkZWRGaWxlID0gYXdhaXQgYWkuZmlsZXMudXBsb2FkKHtcbiAgICAgICAgZmlsZTogbmV3IEJsb2IoW2F3YWl0IHJlYWRGaWxlKGZpbGVQYXRoLCB7ZW5jb2Rpbmc6ICd1dGY4J30pXSwge1xuICAgICAgICAgIHR5cGU6ICd0ZXh0L3BsYWluJyxcbiAgICAgICAgfSksXG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgIGRpc3BsYXlOYW1lOiBgZml4X3JlcXVlc3RfJHtiYXNlbmFtZShmaWxlUGF0aCl9XyR7cmFuZG9tVVVJRCgpfWAsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgYXNzZXJ0KHVwbG9hZGVkRmlsZS5uYW1lLCAnRmlsZSBuYW1lIGNhbm5vdCBiZSB1bmRlZmluZWQgYWZ0ZXIgdXBsb2FkLicpO1xuXG4gICAgICBsZXQgZ2V0RmlsZSA9IGF3YWl0IGFpLmZpbGVzLmdldCh7bmFtZTogdXBsb2FkZWRGaWxlLm5hbWV9KTtcbiAgICAgIHdoaWxlIChnZXRGaWxlLnN0YXRlID09PSBGaWxlU3RhdGUuUFJPQ0VTU0lORykge1xuICAgICAgICBhd2FpdCBzZXRUaW1lb3V0KDUwMCk7IC8vIFdhaXQgZm9yIDUwMG1zIGJlZm9yZSByZS1jaGVja2luZ1xuICAgICAgICBnZXRGaWxlID0gYXdhaXQgYWkuZmlsZXMuZ2V0KHtuYW1lOiB1cGxvYWRlZEZpbGUubmFtZX0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2V0RmlsZS5zdGF0ZSA9PT0gRmlsZVN0YXRlLkZBSUxFRCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZpbGUgcHJvY2Vzc2luZyBmYWlsZWQgb24gQVBJIGZvciAke2ZpbGVQYXRofS4gU2tpcHBpbmcgdGhpcyBmaWxlLmApO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2V0RmlsZS51cmkgJiYgZ2V0RmlsZS5taW1lVHlwZSkge1xuICAgICAgICBjb25zdCBmaWxlUGFydCA9IGNyZWF0ZVBhcnRGcm9tVXJpKGdldEZpbGUudXJpLCBnZXRGaWxlLm1pbWVUeXBlKTtcbiAgICAgICAgcGFydHNGb3JHZW5lcmF0aW9uLnB1c2goZmlsZVBhcnQpO1xuICAgICAgICBmaWxlTmFtZU1hcC5zZXQoZmlsZVBhdGgsIHVwbG9hZGVkRmlsZS5uYW1lKTtcbiAgICAgICAgcHJvZ3Jlc3NCYXIuaW5jcmVtZW50KCk7XG4gICAgICAgIHJldHVybiB1cGxvYWRlZEZpbGUubmFtZTsgLy8gUmV0dXJuIHRoZSBuYW1lIG9uIHN1Y2Nlc3NcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVXBsb2FkZWQgZmlsZSBmb3IgJHtmaWxlUGF0aH0gaXMgbWlzc2luZyBVUkkgb3IgTUlNRSB0eXBlIGFmdGVyIHByb2Nlc3NpbmcuIFNraXBwaW5nLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgTG9nLmVycm9yKGBFcnJvciB1cGxvYWRpbmcgb3IgcHJvY2Vzc2luZyBmaWxlICR7ZmlsZVBhdGh9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICByZXR1cm4gbnVsbDsgLy8gSW5kaWNhdGUgZmFpbHVyZSBmb3IgdGhpcyBzcGVjaWZpYyBmaWxlXG4gICAgfVxuICB9KTtcblxuICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHVwbG9hZFByb21pc2VzKS5maW5hbGx5KCgpID0+IHByb2dyZXNzQmFyLnN0b3AoKSk7XG5cbiAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiByZXN1bHQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgIHVwbG9hZGVkRmlsZU5hbWVzLnB1c2gocmVzdWx0LnZhbHVlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge3VwbG9hZGVkRmlsZU5hbWVzLCBmaWxlTmFtZU1hcCwgcGFydHNGb3JHZW5lcmF0aW9ufTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVQcm9tcHQoZXJyb3JEZXNjcmlwdGlvbjogc3RyaW5nLCBmaWxlTmFtZU1hcDogTWFwPHN0cmluZywgc3RyaW5nPik6IHN0cmluZyB7XG4gIHJldHVybiBgXG4gICAgWW91IGFyZSBhIGhpZ2hseSBza2lsbGVkIHNvZnR3YXJlIGVuZ2luZWVyLCBzcGVjaWFsaXppbmcgaW4gQmF6ZWwsIFN0YXJsYXJrLCBQeXRob24sIEFuZ3VsYXIsIEphdmFTY3JpcHQsXG4gICAgVHlwZVNjcmlwdCwgYW5kIGV2ZXJ5dGhpbmcgcmVsYXRlZC5cbiAgICBUaGUgZm9sbG93aW5nIGZpbGVzIGFyZSBwYXJ0IG9mIGEgYnVpbGQgcHJvY2VzcyB0aGF0IGZhaWxlZCB3aXRoIHRoZSBlcnJvcjpcbiAgICBcXGBcXGBcXGBcbiAgICAke2Vycm9yRGVzY3JpcHRpb259XG4gICAgXFxgXFxgXFxgXG4gICAgUGxlYXNlIGFuYWx5emUgdGhlIGNvbnRlbnQgb2YgRUFDSCBwcm92aWRlZCBmaWxlIGFuZCBzdWdnZXN0IG1vZGlmaWNhdGlvbnMgdG8gcmVzb2x2ZSB0aGUgaXNzdWUuXG5cbiAgICBZb3VyIHJlc3BvbnNlIE1VU1QgYmUgYSBKU09OIGFycmF5IG9mIG9iamVjdHMuIEVhY2ggb2JqZWN0IGluIHRoZSBhcnJheSBNVVNUIGhhdmUgdHdvIHByb3BlcnRpZXM6XG4gICAgJ2ZpbGVQYXRoJyAodGhlIGZ1bGwgcGF0aCBmcm9tIHRoZSBtYXBwaW5ncyBwcm92aWRlZC4pIGFuZCAnY29udGVudCcgKHRoZSBjb21wbGV0ZSBjb3JyZWN0ZWQgY29udGVudCBvZiB0aGF0IGZpbGUpLlxuICAgIERPIE5PVCBpbmNsdWRlIGFueSBhZGRpdGlvbmFsIHRleHQsIG5vbiBtb2RpZmllZCBmaWxlcywgY29tbWVudGFyeSwgb3IgbWFya2Rvd24gb3V0c2lkZSB0aGUgSlNPTiBhcnJheS5cbiAgICBGb3IgZXhhbXBsZTpcbiAgICBbXG4gICAgICB7XCJmaWxlUGF0aFwiOiBcIi9mdWxsLXBhdGgtZnJvbS1tYXBwaW5ncy9maWxlMS50eHRcIiwgXCJjb250ZW50XCI6IFwiQ29ycmVjdGVkIGNvbnRlbnQgZm9yIGZpbGUxLlwifSxcbiAgICAgIHtcImZpbGVQYXRoXCI6IFwiL2Z1bGwtcGF0aC1mcm9tLW1hcHBpbmdzL2ZpbGUyLmpzXCIsIFwiY29udGVudFwiOiBcImNvbnNvbGUubG9nKCdGaXhlZCBKUycpO1wifVxuICAgIF1cblxuICAgIElNUE9SVEFOVDogVGhlIGlucHV0IGZpbGVzIGFyZSBtYXBwZWQgYXMgZm9sbG93czogJHtBcnJheS5mcm9tKGZpbGVOYW1lTWFwLmVudHJpZXMoKSl9XG5gO1xufVxuXG4vKiogQ0xJIGNvbW1hbmQgbW9kdWxlLiAqL1xuZXhwb3J0IGNvbnN0IEZpeE1vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGJ1aWxkZXIsXG4gIGhhbmRsZXIsXG4gIGNvbW1hbmQ6ICdmaXggPGZpbGVzLi4+JyxcbiAgZGVzY3JpYmU6ICdGaXhlcyBlcnJvcnMgZnJvbSB0aGUgc3BlY2lmaWVkIGVycm9yIG91dHB1dCcsXG59O1xuIl19