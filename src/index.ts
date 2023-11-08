import "dotenv/config";
import { OpenAI } from 'openai';
import * as fs from "fs";
import * as path from "path";
import { getAllPageIdsWithTitle, getPageContent, writeContentToMarkdownFile } from "./notion";
import { AssistantCreateParams } from "openai/resources/beta/assistants/assistants";
import axios from "axios";

const configuration = {
  apiKey: process.env.OPENAI_API_KEY, // Make sure to set this environment variable
};

const functions: AssistantCreateParams.AssistantToolsFunction[] = [
  // {
  //   type: "function",
  //   function: {
  //     "name": "downloadNotionFiles",
  //     "description": "download the user's notion files",
  //     "parameters": {
  //       "type": "object",
  //       "properties": {
  //         "api_key": {"type": "string", "description": "the api key relating to that user's notion"},
  //       },
  //       "required": ["api_key"]
  //     }
  //   }
  // },
  // {
  //   type: "function",
  //   function: {
  //     "name": "updateAssistantKnowledge",
  //     "description": "upload any new notion files to the assistant's file store",
  //     "parameters": {
  //       "type": "object",
  //       "properties": {
  //         "files": {
  //           "type": "array",
  //           "description": "a list of new file paths to upload",
  //           "items": {
  //             "type": "string",
  //           },
  //         },
  //       },
  //       "required": ["files"]
  //     }
  //   }
  // }
]

const openai = new OpenAI(configuration);

async function init(assistantId?: string) {
  let assistant: OpenAI.Beta.Assistants.Assistant;

  try {
    assistant = await openai.beta.assistants.retrieve(assistantId as string);
  } catch (e) {
    // console.error(e);
    assistant = await openai.beta.assistants.create({
      name: "broski",
      model: "gpt-4-1106-preview",
      instructions: "you are a simple chat bot that can access my notion pages and respond to questions about them",
      tools: [{ type: "retrieval" }, ...functions]
    });
  }

  const res = await downloadNotionFiles("");
  await updateAssistantKnowledge(assistant.id, res.filePaths ?? []);

  // const thread = await openai.beta.threads.create({});

  // const message = await openai.beta.threads.messages.create(
  //   thread.id,
  //   {
  //     role: "user",
  //     content: "summarize the uploaded notion documents"
  //   }
  // );

  // const run = await openai.beta.threads.runs.create(
  //   thread.id,
  //   { 
  //     assistant_id: assistant.id,
  //     // instructions: "the abreviation for spark sessions is ss"
  //   }
  // );

  // let runDone = false;

  // while (!runDone) {
  //   const runStatus = (await openai.beta.threads.runs.retrieve(
  //     thread.id,
  //     run.id
  //   )).status;

  //   switch (runStatus) {
  //     case "completed":
  //       runDone = true;
  //       break;
  //     case "cancelled":
  //       runDone = true;
  //       break;
  //     case "failed":
  //       runDone = true;
  //       break;
  //     case "expired":
  //       runDone = true;
  //       break;
  //     default:
  //       await new Promise(resolve => setTimeout(resolve, 1000));
  //   }
  // }

  // const messages = await openai.beta.threads.messages.list(
  //   thread.id
  // );

  // // @ts-ignore
  // console.log(messages.data.map((el) => (el.content.at(0)["text"])));
}

async function downloadNotionFiles(apiKey: string) {
  const filePaths: string[] = [];

  try {
    const pages = await getAllPageIdsWithTitle();

    await Promise.all(pages.map(async (page) => {
      const content = await getPageContent(page.id);
      const filename = page.title.replaceAll(" ", "-").concat(".md");
      writeContentToMarkdownFile(content, filename);
      filePaths.push("notion-pages".concat("/", filename));
    }))
  } catch (e) {
    console.error("couldn't download files");
    return { success: false };
  }

  return { success: true, filePaths };
}

async function updateAssistantKnowledge(assistantId: string, filePaths: string[]) {
  // const fileNames = (await openai.beta.assistants.files.list(assistantId)).data.map(async (f) => (await openai.beta.assistants.files.retrieve(f.assistant_id, f.id)).)
  const ids = await Promise.all(filePaths.map(async (fp) => {
    const file = await openai.files.create({
      file: fs.createReadStream(path.join(...fp.split("/"))),
      purpose: "assistants",
    });

    return file.id;
  }));

  const assistant = await openai.beta.assistants.update(assistantId, {
    file_ids: [...ids]
  })
}


async function deleteAllFiles() {
  try {
    const response = await axios.get('https://api.openai.com/v1/files', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    
    // Assuming the structure of the response is:
    // { data: [{ id: 'some-id' }, ...] }
    const dataField = response.data.data;
    
    if (!Array.isArray(dataField)) {
      throw new Error('Expected data field to be an array');
    }

    // Extract the 'id' field from each object in the data array
    const idList = dataField.map((item: any) => item.id);
    
    await Promise.all(idList.map(async (id) => {
      try {
        await axios.delete(`https://api.openai.com/v1/files/${id}`, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        });
        console.log(`File with ID ${id} has been deleted.`);
      } catch (error) {
        console.error(`Error deleting file with ID ${id}:`, error);
      }
    }))
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

(async () => {
  await deleteAllFiles();
  await init("asst_g5KupO79Cwe4Wam5qsWNzRFH");
})();