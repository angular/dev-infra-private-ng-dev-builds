/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile } from 'fs/promises';
import { SingleBar, Presets } from 'cli-progress';
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_API_KEY } from './consts.js';
import assert from 'node:assert';
import { Log } from '../utils/logging.js';
import glob from 'fast-glob';
/** Yargs command builder for the command. */
function builder(argv) {
    return argv
        .option('prompt', {
        type: 'string',
        alias: 'p',
        description: 'Path to the file containg the prompt that will be run',
        demandOption: true,
    })
        .option('files', {
        type: 'string',
        alias: 'f',
        description: 'Glob for the files that should be migrated',
        demandOption: true,
    })
        .option('model', {
        type: 'string',
        alias: 'm',
        description: 'Model to use for the migration',
        default: DEFAULT_MODEL,
    })
        .option('maxConcurrency', {
        type: 'number',
        default: 25,
        description: 'Maximum number of concurrent requests to the API. Higher numbers may hit usages limits',
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
    const [files, prompt] = await Promise.all([
        glob([options.files]),
        readFile(options.prompt, 'utf-8'),
    ]);
    if (files.length === 0) {
        Log.error(`No files matched the pattern "${options.files}"`);
        process.exit(1);
    }
    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const progressBar = new SingleBar({}, Presets.shades_grey);
    const failures = [];
    const running = new Set();
    Log.info([
        `Applying prompt from ${options.prompt} to ${files.length} files(s).`,
        `Using model ${options.model} with a temperature of ${options.temperature}.`,
        '', // Extra new line at the end.
    ].join('\n'));
    progressBar.start(files.length, 0);
    // Kicks off the maximum number of concurrent requests and ensures that as many requests as
    // possible are running at the same time. This is preferrable to chunking, because it allows
    // the requests to keep running even if there's one which is taking a long time to resolve.
    while (files.length > 0 || running.size > 0) {
        // Fill up to maxConcurrency
        while (files.length > 0 && running.size < options.maxConcurrency) {
            const file = files.shift();
            const task = processFile(file).finally(() => running.delete(task));
            running.add(task);
        }
        // Wait for any task to finish
        if (running.size > 0) {
            await Promise.race(running);
        }
    }
    progressBar.stop();
    for (const { name, error } of failures) {
        Log.info('-------------------------------------');
        Log.info(`${name} failed to migrate:`);
        Log.info(error);
    }
    Log.info(`\nDone 🎉`);
    if (failures.length > 0) {
        Log.info(`${failures.length} file(s) failed. See logs above for more information.`);
    }
    async function processFile(file) {
        try {
            const content = await readFile(file, 'utf-8');
            const result = await applyPrompt(ai, options.model, options.temperature, content, prompt);
            await writeFile(file, result);
        }
        catch (e) {
            failures.push({ name: file, error: e.toString() });
        }
        finally {
            progressBar.increment();
        }
    }
}
/**
 * Applies a prompt to a specific file's content.
 * @param ai Instance of the GenAI SDK.
 * @param model Model to use for the prompt.
 * @param temperature Temperature for the promp.
 * @param content Content of the file.
 * @param prompt Prompt to be run.
 */
async function applyPrompt(ai, model, temperature, content, prompt) {
    // The schema ensures that the API returns a response in the format that we expect.
    const responseSchema = {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'Changed content of the file' },
        },
        required: ['content'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
    };
    // Note that technically we can batch multiple files into a single `generateContent` call.
    // We don't do it, because it increases the risk that we'll hit the output token limit which
    // can corrupt the entire response. This way one file failing won't break the entire run.
    const response = await ai.models.generateContent({
        model,
        contents: [{ text: prompt }, { text: content }],
        config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature,
            // We need as many output tokens as we can get.
            maxOutputTokens: Infinity,
            // We know that we'll only use one candidate so we can save some processing.
            candidateCount: 1,
            // Guide the LLM towards following our schema.
            systemInstruction: `Return output following the structured output schema. ` +
                `Return an object containing the new contents of the changed file.`,
        },
    });
    const text = response.text;
    if (!text) {
        throw new Error(`No response from the API. Response:\n` + JSON.stringify(response, null, 2));
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error('Failed to parse result as JSON. This can happen if if maximum output ' +
            'token size has been reached. Try using a different model. ' +
            'Response:\n' +
            JSON.stringify(response, null, 2));
    }
    if (!parsed.content) {
        throw new Error('Could not find content in parsed API response. This can indicate a problem ' +
            'with the request parameters. Parsed response:\n' +
            JSON.stringify(parsed, null, 2));
    }
    return parsed.content;
}
/** CLI command module. */
export const MigrateModule = {
    builder,
    handler,
    command: 'migrate',
    describe: 'Apply a prompt-based AI migration over a set of files',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi9haS9taWdyYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFMUMsT0FBTyxFQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDaEQsT0FBTyxFQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDaEQsT0FBTyxFQUFDLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDaEYsT0FBTyxNQUFNLE1BQU0sYUFBYSxDQUFDO0FBQ2pDLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUN4QyxPQUFPLElBQUksTUFBTSxXQUFXLENBQUM7QUF1QjdCLDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSTtTQUNSLE1BQU0sQ0FBQyxRQUFRLEVBQUU7UUFDaEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxLQUFLLEVBQUUsR0FBRztRQUNWLFdBQVcsRUFBRSx1REFBdUQ7UUFDcEUsWUFBWSxFQUFFLElBQUk7S0FDbkIsQ0FBQztTQUNELE1BQU0sQ0FBQyxPQUFPLEVBQUU7UUFDZixJQUFJLEVBQUUsUUFBUTtRQUNkLEtBQUssRUFBRSxHQUFHO1FBQ1YsV0FBVyxFQUFFLDRDQUE0QztRQUN6RCxZQUFZLEVBQUUsSUFBSTtLQUNuQixDQUFDO1NBQ0QsTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUNmLElBQUksRUFBRSxRQUFRO1FBQ2QsS0FBSyxFQUFFLEdBQUc7UUFDVixXQUFXLEVBQUUsZ0NBQWdDO1FBQzdDLE9BQU8sRUFBRSxhQUFhO0tBQ3ZCLENBQUM7U0FDRCxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7UUFDeEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsRUFBRTtRQUNYLFdBQVcsRUFDVCx3RkFBd0Y7S0FDM0YsQ0FBQztTQUNELE1BQU0sQ0FBQyxhQUFhLEVBQUU7UUFDckIsSUFBSSxFQUFFLFFBQVE7UUFDZCxLQUFLLEVBQUUsR0FBRztRQUNWLE9BQU8sRUFBRSxtQkFBbUI7UUFDNUIsV0FBVyxFQUFFLDRFQUE0RTtLQUMxRixDQUFDO1NBQ0QsTUFBTSxDQUFDLFFBQVEsRUFBRTtRQUNoQixJQUFJLEVBQUUsUUFBUTtRQUNkLEtBQUssRUFBRSxHQUFHO1FBQ1YsT0FBTyxFQUFFLGVBQWU7UUFDeEIsV0FBVyxFQUFFLGtEQUFrRDtLQUNoRSxDQUFDLENBQUM7QUFDUCxDQUFDO0FBRUQsNkNBQTZDO0FBQzdDLEtBQUssVUFBVSxPQUFPLENBQUMsT0FBMkI7SUFDaEQsTUFBTSxDQUNKLE9BQU8sQ0FBQyxNQUFNLEVBQ2Q7UUFDRSwwRkFBMEY7WUFDeEYsb0RBQW9EO1FBQ3RELDRDQUE0QztLQUM3QyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FDYixDQUFDO0lBRUYsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7UUFDeEMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JCLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztLQUNsQyxDQUFDLENBQUM7SUFFSCxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDdkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDN0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxFQUFFLEdBQUcsSUFBSSxXQUFXLENBQUMsRUFBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBQyxDQUFDLENBQUM7SUFDckQsTUFBTSxXQUFXLEdBQUcsSUFBSSxTQUFTLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUMzRCxNQUFNLFFBQVEsR0FBb0MsRUFBRSxDQUFDO0lBQ3JELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO0lBRXpDLEdBQUcsQ0FBQyxJQUFJLENBQ047UUFDRSx3QkFBd0IsT0FBTyxDQUFDLE1BQU0sT0FBTyxLQUFLLENBQUMsTUFBTSxZQUFZO1FBQ3JFLGVBQWUsT0FBTyxDQUFDLEtBQUssMEJBQTBCLE9BQU8sQ0FBQyxXQUFXLEdBQUc7UUFDNUUsRUFBRSxFQUFFLDZCQUE2QjtLQUNsQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FDYixDQUFDO0lBQ0YsV0FBVyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRW5DLDJGQUEyRjtJQUMzRiw0RkFBNEY7SUFDNUYsMkZBQTJGO0lBQzNGLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUM1Qyw0QkFBNEI7UUFDNUIsT0FBTyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNqRSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFHLENBQUM7WUFDNUIsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbkUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQixDQUFDO1FBRUQsOEJBQThCO1FBQzlCLElBQUksT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNyQixNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUIsQ0FBQztJQUNILENBQUM7SUFFRCxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFbkIsS0FBSyxNQUFNLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBQyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLEdBQUcsQ0FBQyxJQUFJLENBQUMsdUNBQXVDLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3ZDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFdEIsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3hCLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSx1REFBdUQsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFRCxLQUFLLFVBQVUsV0FBVyxDQUFDLElBQVk7UUFDckMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzlDLE1BQU0sTUFBTSxHQUFHLE1BQU0sV0FBVyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRyxDQUFXLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxDQUFDO1FBQzlELENBQUM7Z0JBQVMsQ0FBQztZQUNULFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUMxQixDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsS0FBSyxVQUFVLFdBQVcsQ0FDeEIsRUFBZSxFQUNmLEtBQWEsRUFDYixXQUFtQixFQUNuQixPQUFlLEVBQ2YsTUFBYztJQUVkLG1GQUFtRjtJQUNuRixNQUFNLGNBQWMsR0FBRztRQUNyQixJQUFJLEVBQUUsUUFBUTtRQUNkLFVBQVUsRUFBRTtZQUNWLE9BQU8sRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLDZCQUE2QixFQUFDO1NBQ3RFO1FBQ0QsUUFBUSxFQUFFLENBQUMsU0FBUyxDQUFDO1FBQ3JCLG9CQUFvQixFQUFFLEtBQUs7UUFDM0IsT0FBTyxFQUFFLHlDQUF5QztLQUNuRCxDQUFDO0lBRUYsMEZBQTBGO0lBQzFGLDRGQUE0RjtJQUM1Rix5RkFBeUY7SUFDekYsTUFBTSxRQUFRLEdBQUcsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQztRQUMvQyxLQUFLO1FBQ0wsUUFBUSxFQUFFLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7UUFDM0MsTUFBTSxFQUFFO1lBQ04sZ0JBQWdCLEVBQUUsa0JBQWtCO1lBQ3BDLGNBQWM7WUFDZCxXQUFXO1lBQ1gsK0NBQStDO1lBQy9DLGVBQWUsRUFBRSxRQUFRO1lBQ3pCLDRFQUE0RTtZQUM1RSxjQUFjLEVBQUUsQ0FBQztZQUNqQiw4Q0FBOEM7WUFDOUMsaUJBQWlCLEVBQ2Ysd0RBQXdEO2dCQUN4RCxtRUFBbUU7U0FDdEU7S0FDRixDQUFDLENBQUM7SUFFSCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBRTNCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUVELElBQUksTUFBMEIsQ0FBQztJQUUvQixJQUFJLENBQUM7UUFDSCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQXNCLENBQUM7SUFDakQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE1BQU0sSUFBSSxLQUFLLENBQ2IsdUVBQXVFO1lBQ3JFLDREQUE0RDtZQUM1RCxhQUFhO1lBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUNwQyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FDYiw2RUFBNkU7WUFDM0UsaURBQWlEO1lBQ2pELElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FDbEMsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUM7QUFDeEIsQ0FBQztBQUVELDBCQUEwQjtBQUMxQixNQUFNLENBQUMsTUFBTSxhQUFhLEdBQStCO0lBQ3ZELE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLFNBQVM7SUFDbEIsUUFBUSxFQUFFLHVEQUF1RDtDQUNsRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7R29vZ2xlR2VuQUl9IGZyb20gJ0Bnb29nbGUvZ2VuYWknO1xuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7cmVhZEZpbGUsIHdyaXRlRmlsZX0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHtTaW5nbGVCYXIsIFByZXNldHN9IGZyb20gJ2NsaS1wcm9ncmVzcyc7XG5pbXBvcnQge0RFRkFVTFRfTU9ERUwsIERFRkFVTFRfVEVNUEVSQVRVUkUsIERFRkFVTFRfQVBJX0tFWX0gZnJvbSAnLi9jb25zdHMuanMnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdmYXN0LWdsb2InO1xuXG4vKiogQ29tbWFuZCBsaW5lIG9wdGlvbnMuICovXG5leHBvcnQgaW50ZXJmYWNlIE9wdGlvbnMge1xuICAvKiogUHJvbXB0IHRoYXQgc2hvdWxkIGJlIGFwcGxpZWQuICovXG4gIHByb21wdDogc3RyaW5nO1xuXG4gIC8qKiBHbG9iIG9mIGZpbGVzIHRoYXQgdGhlIHByb21wdCBzaG91bGQgYXBwbHkgdG8uICovXG4gIGZpbGVzOiBzdHJpbmc7XG5cbiAgLyoqIE1vZGVsIHRoYXQgc2hvdWxkIGJlIHVzZWQgdG8gYXBwbHkgdGhlIHByb21wdC4gKi9cbiAgbW9kZWw6IHN0cmluZztcblxuICAvKiogVGVtcGVyYXR1cmUgZm9yIHRoZSBtb2RlbC4gKi9cbiAgdGVtcGVyYXR1cmU6IG51bWJlcjtcblxuICAvKiogTWF4aW11bSBudW1iZXIgb2YgY29uY3VycmVudCBBUEkgcmVxdWVzdHMuICovXG4gIG1heENvbmN1cnJlbmN5OiBudW1iZXI7XG5cbiAgLyoqIEFQSSBrZXkgdG8gdXNlIHdoZW4gbWFraW5nIHJlcXVlc3RzLiAqL1xuICBhcGlLZXk/OiBzdHJpbmc7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGJ1aWxkZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcihhcmd2OiBBcmd2KTogQXJndjxPcHRpb25zPiB7XG4gIHJldHVybiBhcmd2XG4gICAgLm9wdGlvbigncHJvbXB0Jywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBhbGlhczogJ3AnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIHRoZSBmaWxlIGNvbnRhaW5nIHRoZSBwcm9tcHQgdGhhdCB3aWxsIGJlIHJ1bicsXG4gICAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gICAgfSlcbiAgICAub3B0aW9uKCdmaWxlcycsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgYWxpYXM6ICdmJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2xvYiBmb3IgdGhlIGZpbGVzIHRoYXQgc2hvdWxkIGJlIG1pZ3JhdGVkJyxcbiAgICAgIGRlbWFuZE9wdGlvbjogdHJ1ZSxcbiAgICB9KVxuICAgIC5vcHRpb24oJ21vZGVsJywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBhbGlhczogJ20nLFxuICAgICAgZGVzY3JpcHRpb246ICdNb2RlbCB0byB1c2UgZm9yIHRoZSBtaWdyYXRpb24nLFxuICAgICAgZGVmYXVsdDogREVGQVVMVF9NT0RFTCxcbiAgICB9KVxuICAgIC5vcHRpb24oJ21heENvbmN1cnJlbmN5Jywge1xuICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICBkZWZhdWx0OiAyNSxcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAnTWF4aW11bSBudW1iZXIgb2YgY29uY3VycmVudCByZXF1ZXN0cyB0byB0aGUgQVBJLiBIaWdoZXIgbnVtYmVycyBtYXkgaGl0IHVzYWdlcyBsaW1pdHMnLFxuICAgIH0pXG4gICAgLm9wdGlvbigndGVtcGVyYXR1cmUnLCB7XG4gICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgIGFsaWFzOiAndCcsXG4gICAgICBkZWZhdWx0OiBERUZBVUxUX1RFTVBFUkFUVVJFLFxuICAgICAgZGVzY3JpcHRpb246ICdUZW1wZXJhdHVyZSBmb3IgdGhlIG1vZGVsLiBMb3dlciB0ZW1wZXJhdHVyZSByZWR1Y2VzIHJhbmRvbW5lc3MvY3JlYXRpdml0eScsXG4gICAgfSlcbiAgICAub3B0aW9uKCdhcGlLZXknLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGFsaWFzOiAnYScsXG4gICAgICBkZWZhdWx0OiBERUZBVUxUX0FQSV9LRVksXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBrZXkgdXNlZCB3aGVuIG1ha2luZyBjYWxscyB0byB0aGUgR2VtaW5pIEFQSScsXG4gICAgfSk7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGhhbmRsZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihvcHRpb25zOiBBcmd1bWVudHM8T3B0aW9ucz4pIHtcbiAgYXNzZXJ0KFxuICAgIG9wdGlvbnMuYXBpS2V5LFxuICAgIFtcbiAgICAgICdObyBBUEkga2V5IGNvbmZpZ3VyZWQuIEEgR2VtaW5pIEFQSSBrZXkgbXVzdCBiZSBzZXQgYXMgdGhlIGBHRU1JTklfQVBJX0tFWWAgZW52aXJvbm1lbnQgJyArXG4gICAgICAgICd2YXJpYWJsZSwgb3IgcGFzc2VkIGluIHVzaW5nIHRoZSBgLS1hcGkta2V5YCBmbGFnLicsXG4gICAgICAnRm9yIGludGVybmFsIHVzZXJzLCBzZWUgZ28vYWlzdHVkaW8tYXBpa2V5JyxcbiAgICBdLmpvaW4oJ1xcbicpLFxuICApO1xuXG4gIGNvbnN0IFtmaWxlcywgcHJvbXB0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBnbG9iKFtvcHRpb25zLmZpbGVzXSksXG4gICAgcmVhZEZpbGUob3B0aW9ucy5wcm9tcHQsICd1dGYtOCcpLFxuICBdKTtcblxuICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgTG9nLmVycm9yKGBObyBmaWxlcyBtYXRjaGVkIHRoZSBwYXR0ZXJuIFwiJHtvcHRpb25zLmZpbGVzfVwiYCk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG5cbiAgY29uc3QgYWkgPSBuZXcgR29vZ2xlR2VuQUkoe2FwaUtleTogb3B0aW9ucy5hcGlLZXl9KTtcbiAgY29uc3QgcHJvZ3Jlc3NCYXIgPSBuZXcgU2luZ2xlQmFyKHt9LCBQcmVzZXRzLnNoYWRlc19ncmV5KTtcbiAgY29uc3QgZmFpbHVyZXM6IHtuYW1lOiBzdHJpbmc7IGVycm9yOiBzdHJpbmd9W10gPSBbXTtcbiAgY29uc3QgcnVubmluZyA9IG5ldyBTZXQ8UHJvbWlzZTx2b2lkPj4oKTtcblxuICBMb2cuaW5mbyhcbiAgICBbXG4gICAgICBgQXBwbHlpbmcgcHJvbXB0IGZyb20gJHtvcHRpb25zLnByb21wdH0gdG8gJHtmaWxlcy5sZW5ndGh9IGZpbGVzKHMpLmAsXG4gICAgICBgVXNpbmcgbW9kZWwgJHtvcHRpb25zLm1vZGVsfSB3aXRoIGEgdGVtcGVyYXR1cmUgb2YgJHtvcHRpb25zLnRlbXBlcmF0dXJlfS5gLFxuICAgICAgJycsIC8vIEV4dHJhIG5ldyBsaW5lIGF0IHRoZSBlbmQuXG4gICAgXS5qb2luKCdcXG4nKSxcbiAgKTtcbiAgcHJvZ3Jlc3NCYXIuc3RhcnQoZmlsZXMubGVuZ3RoLCAwKTtcblxuICAvLyBLaWNrcyBvZmYgdGhlIG1heGltdW0gbnVtYmVyIG9mIGNvbmN1cnJlbnQgcmVxdWVzdHMgYW5kIGVuc3VyZXMgdGhhdCBhcyBtYW55IHJlcXVlc3RzIGFzXG4gIC8vIHBvc3NpYmxlIGFyZSBydW5uaW5nIGF0IHRoZSBzYW1lIHRpbWUuIFRoaXMgaXMgcHJlZmVycmFibGUgdG8gY2h1bmtpbmcsIGJlY2F1c2UgaXQgYWxsb3dzXG4gIC8vIHRoZSByZXF1ZXN0cyB0byBrZWVwIHJ1bm5pbmcgZXZlbiBpZiB0aGVyZSdzIG9uZSB3aGljaCBpcyB0YWtpbmcgYSBsb25nIHRpbWUgdG8gcmVzb2x2ZS5cbiAgd2hpbGUgKGZpbGVzLmxlbmd0aCA+IDAgfHwgcnVubmluZy5zaXplID4gMCkge1xuICAgIC8vIEZpbGwgdXAgdG8gbWF4Q29uY3VycmVuY3lcbiAgICB3aGlsZSAoZmlsZXMubGVuZ3RoID4gMCAmJiBydW5uaW5nLnNpemUgPCBvcHRpb25zLm1heENvbmN1cnJlbmN5KSB7XG4gICAgICBjb25zdCBmaWxlID0gZmlsZXMuc2hpZnQoKSE7XG4gICAgICBjb25zdCB0YXNrID0gcHJvY2Vzc0ZpbGUoZmlsZSkuZmluYWxseSgoKSA9PiBydW5uaW5nLmRlbGV0ZSh0YXNrKSk7XG4gICAgICBydW5uaW5nLmFkZCh0YXNrKTtcbiAgICB9XG5cbiAgICAvLyBXYWl0IGZvciBhbnkgdGFzayB0byBmaW5pc2hcbiAgICBpZiAocnVubmluZy5zaXplID4gMCkge1xuICAgICAgYXdhaXQgUHJvbWlzZS5yYWNlKHJ1bm5pbmcpO1xuICAgIH1cbiAgfVxuXG4gIHByb2dyZXNzQmFyLnN0b3AoKTtcblxuICBmb3IgKGNvbnN0IHtuYW1lLCBlcnJvcn0gb2YgZmFpbHVyZXMpIHtcbiAgICBMb2cuaW5mbygnLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLScpO1xuICAgIExvZy5pbmZvKGAke25hbWV9IGZhaWxlZCB0byBtaWdyYXRlOmApO1xuICAgIExvZy5pbmZvKGVycm9yKTtcbiAgfVxuXG4gIExvZy5pbmZvKGBcXG5Eb25lIPCfjolgKTtcblxuICBpZiAoZmFpbHVyZXMubGVuZ3RoID4gMCkge1xuICAgIExvZy5pbmZvKGAke2ZhaWx1cmVzLmxlbmd0aH0gZmlsZShzKSBmYWlsZWQuIFNlZSBsb2dzIGFib3ZlIGZvciBtb3JlIGluZm9ybWF0aW9uLmApO1xuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0ZpbGUoZmlsZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZShmaWxlLCAndXRmLTgnKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwcGx5UHJvbXB0KGFpLCBvcHRpb25zLm1vZGVsLCBvcHRpb25zLnRlbXBlcmF0dXJlLCBjb250ZW50LCBwcm9tcHQpO1xuICAgICAgYXdhaXQgd3JpdGVGaWxlKGZpbGUsIHJlc3VsdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZmFpbHVyZXMucHVzaCh7bmFtZTogZmlsZSwgZXJyb3I6IChlIGFzIEVycm9yKS50b1N0cmluZygpfSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHByb2dyZXNzQmFyLmluY3JlbWVudCgpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFwcGxpZXMgYSBwcm9tcHQgdG8gYSBzcGVjaWZpYyBmaWxlJ3MgY29udGVudC5cbiAqIEBwYXJhbSBhaSBJbnN0YW5jZSBvZiB0aGUgR2VuQUkgU0RLLlxuICogQHBhcmFtIG1vZGVsIE1vZGVsIHRvIHVzZSBmb3IgdGhlIHByb21wdC5cbiAqIEBwYXJhbSB0ZW1wZXJhdHVyZSBUZW1wZXJhdHVyZSBmb3IgdGhlIHByb21wLlxuICogQHBhcmFtIGNvbnRlbnQgQ29udGVudCBvZiB0aGUgZmlsZS5cbiAqIEBwYXJhbSBwcm9tcHQgUHJvbXB0IHRvIGJlIHJ1bi5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gYXBwbHlQcm9tcHQoXG4gIGFpOiBHb29nbGVHZW5BSSxcbiAgbW9kZWw6IHN0cmluZyxcbiAgdGVtcGVyYXR1cmU6IG51bWJlcixcbiAgY29udGVudDogc3RyaW5nLFxuICBwcm9tcHQ6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIC8vIFRoZSBzY2hlbWEgZW5zdXJlcyB0aGF0IHRoZSBBUEkgcmV0dXJucyBhIHJlc3BvbnNlIGluIHRoZSBmb3JtYXQgdGhhdCB3ZSBleHBlY3QuXG4gIGNvbnN0IHJlc3BvbnNlU2NoZW1hID0ge1xuICAgIHR5cGU6ICdvYmplY3QnLFxuICAgIHByb3BlcnRpZXM6IHtcbiAgICAgIGNvbnRlbnQ6IHt0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdDaGFuZ2VkIGNvbnRlbnQgb2YgdGhlIGZpbGUnfSxcbiAgICB9LFxuICAgIHJlcXVpcmVkOiBbJ2NvbnRlbnQnXSxcbiAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgJHNjaGVtYTogJ2h0dHA6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQtMDcvc2NoZW1hIycsXG4gIH07XG5cbiAgLy8gTm90ZSB0aGF0IHRlY2huaWNhbGx5IHdlIGNhbiBiYXRjaCBtdWx0aXBsZSBmaWxlcyBpbnRvIGEgc2luZ2xlIGBnZW5lcmF0ZUNvbnRlbnRgIGNhbGwuXG4gIC8vIFdlIGRvbid0IGRvIGl0LCBiZWNhdXNlIGl0IGluY3JlYXNlcyB0aGUgcmlzayB0aGF0IHdlJ2xsIGhpdCB0aGUgb3V0cHV0IHRva2VuIGxpbWl0IHdoaWNoXG4gIC8vIGNhbiBjb3JydXB0IHRoZSBlbnRpcmUgcmVzcG9uc2UuIFRoaXMgd2F5IG9uZSBmaWxlIGZhaWxpbmcgd29uJ3QgYnJlYWsgdGhlIGVudGlyZSBydW4uXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYWkubW9kZWxzLmdlbmVyYXRlQ29udGVudCh7XG4gICAgbW9kZWwsXG4gICAgY29udGVudHM6IFt7dGV4dDogcHJvbXB0fSwge3RleHQ6IGNvbnRlbnR9XSxcbiAgICBjb25maWc6IHtcbiAgICAgIHJlc3BvbnNlTWltZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIHJlc3BvbnNlU2NoZW1hLFxuICAgICAgdGVtcGVyYXR1cmUsXG4gICAgICAvLyBXZSBuZWVkIGFzIG1hbnkgb3V0cHV0IHRva2VucyBhcyB3ZSBjYW4gZ2V0LlxuICAgICAgbWF4T3V0cHV0VG9rZW5zOiBJbmZpbml0eSxcbiAgICAgIC8vIFdlIGtub3cgdGhhdCB3ZSdsbCBvbmx5IHVzZSBvbmUgY2FuZGlkYXRlIHNvIHdlIGNhbiBzYXZlIHNvbWUgcHJvY2Vzc2luZy5cbiAgICAgIGNhbmRpZGF0ZUNvdW50OiAxLFxuICAgICAgLy8gR3VpZGUgdGhlIExMTSB0b3dhcmRzIGZvbGxvd2luZyBvdXIgc2NoZW1hLlxuICAgICAgc3lzdGVtSW5zdHJ1Y3Rpb246XG4gICAgICAgIGBSZXR1cm4gb3V0cHV0IGZvbGxvd2luZyB0aGUgc3RydWN0dXJlZCBvdXRwdXQgc2NoZW1hLiBgICtcbiAgICAgICAgYFJldHVybiBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgbmV3IGNvbnRlbnRzIG9mIHRoZSBjaGFuZ2VkIGZpbGUuYCxcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gcmVzcG9uc2UudGV4dDtcblxuICBpZiAoIXRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIHJlc3BvbnNlIGZyb20gdGhlIEFQSS4gUmVzcG9uc2U6XFxuYCArIEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLCBudWxsLCAyKSk7XG4gIH1cblxuICBsZXQgcGFyc2VkOiB7Y29udGVudD86IHN0cmluZ307XG5cbiAgdHJ5IHtcbiAgICBwYXJzZWQgPSBKU09OLnBhcnNlKHRleHQpIGFzIHtjb250ZW50OiBzdHJpbmd9O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnRmFpbGVkIHRvIHBhcnNlIHJlc3VsdCBhcyBKU09OLiBUaGlzIGNhbiBoYXBwZW4gaWYgaWYgbWF4aW11bSBvdXRwdXQgJyArXG4gICAgICAgICd0b2tlbiBzaXplIGhhcyBiZWVuIHJlYWNoZWQuIFRyeSB1c2luZyBhIGRpZmZlcmVudCBtb2RlbC4gJyArXG4gICAgICAgICdSZXNwb25zZTpcXG4nICtcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UsIG51bGwsIDIpLFxuICAgICk7XG4gIH1cblxuICBpZiAoIXBhcnNlZC5jb250ZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0NvdWxkIG5vdCBmaW5kIGNvbnRlbnQgaW4gcGFyc2VkIEFQSSByZXNwb25zZS4gVGhpcyBjYW4gaW5kaWNhdGUgYSBwcm9ibGVtICcgK1xuICAgICAgICAnd2l0aCB0aGUgcmVxdWVzdCBwYXJhbWV0ZXJzLiBQYXJzZWQgcmVzcG9uc2U6XFxuJyArXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHBhcnNlZCwgbnVsbCwgMiksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBwYXJzZWQuY29udGVudDtcbn1cblxuLyoqIENMSSBjb21tYW5kIG1vZHVsZS4gKi9cbmV4cG9ydCBjb25zdCBNaWdyYXRlTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBPcHRpb25zPiA9IHtcbiAgYnVpbGRlcixcbiAgaGFuZGxlcixcbiAgY29tbWFuZDogJ21pZ3JhdGUnLFxuICBkZXNjcmliZTogJ0FwcGx5IGEgcHJvbXB0LWJhc2VkIEFJIG1pZ3JhdGlvbiBvdmVyIGEgc2V0IG9mIGZpbGVzJyxcbn07XG4iXX0=