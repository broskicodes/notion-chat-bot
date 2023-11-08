import "dotenv/config";
import { Client as NotionClient } from '@notionhq/client';
import { SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import * as fs from "fs";
import * as path from "path";

const notion = new NotionClient({
  auth: process.env.NOTION_TOKEN,
});

interface Page {
  id: string;
  title: string;
}

interface FormattedText {
  type: string;
  text: string;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

export async function getPageContent(pageId: string): Promise<FormattedText[]> {
  const contents: FormattedText[] = [];

  try {
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });

    response.results.forEach((block) => {
      let textElements: FormattedText[] = [];

      // Function to extract text content from a block
      const extractTextContent = (richTextItems: any[]) => {
        return richTextItems.map((richTextItem) => ({
                // @ts-ignore
          type: block.type,
          text: richTextItem.text.content,
          annotations: richTextItem.annotations,
        }));
      };

      if (block.object === 'block') {
        // @ts-ignore
        switch (block.type) {
          case 'paragraph':
        // @ts-ignore
        if (block.paragraph.rich_text) {
        // @ts-ignore
        textElements = extractTextContent(block.paragraph.rich_text);
            }
            break;
          case 'heading_1':
        // @ts-ignore
        if (block.heading_1.rich_text) {
        // @ts-ignore
        textElements = extractTextContent(block.heading_1.rich_text);
            }
            break;
          case 'heading_2':
        // @ts-ignore
        if (block.heading_2.rich_text) {
        // @ts-ignore
        textElements = extractTextContent(block.heading_2.rich_text);
            }
            break;
          case 'heading_3':
        // @ts-ignore
        if (block.heading_3.rich_text) {
        // @ts-ignore
        textElements = extractTextContent(block.heading_3.rich_text);
            }
            break;
          case 'bulleted_list_item':
        // @ts-ignore
        if (block.bulleted_list_item.rich_text) {
        // @ts-ignore
        textElements = extractTextContent(block.bulleted_list_item.rich_text);
            }
            break;
          // Add more cases for other block types if needed
        }
      }

      contents.push(...textElements);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error retrieving page content:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }

  return contents;
}

export async function getAllPageIdsWithTitle(): Promise<Page[]> {
  const pages: Page[] = [];
  let hasMore = true;
  let startCursor: undefined | string = undefined;

  try {
    while (hasMore) {
      const response: SearchResponse = await notion.search({
        sort: {
          direction: 'ascending',
          timestamp: 'last_edited_time',
        },
        // pageSize: 100,
        start_cursor: startCursor,
        filter: {
          property: 'object',
          value: 'page',
        },
      });
      
      // Iterate over the search results and extract the ID and title
      response.results.forEach((page) => {
        if (page.object === 'page') {
          // @ts-ignore
          const titleProperty = page.properties.title;
          
          // Get the title for the page, assuming it's the first text object in the title array
          const titleText = titleProperty?.title[0]?.plain_text ?? 'Untitled';

          pages.push({
            id: page.id,
            title: titleText,
          });
        }
      });

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error retrieving pages:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }

  return pages;
}

export function formatAsMarkdown(contents: FormattedText[], outputFilename: string): string {
  return "# " + outputFilename.slice(0, -3) + "\n" + contents
    .map((item) => {
      const prefix = item.type.startsWith('heading') ? '#'.repeat(parseInt(item.type.slice(-1), 10)) + ' ' : item.type === 'bulleted_list_item' ? "- " : '';
      const suffix = item.type === 'bulleted_list_item' ? '' : '';
      const content = item.annotations.code
        ? '`' + item.text + '`'
        : item.text;

      // Apply other formatting here if needed (bold, italic, etc.)

      return prefix + content + suffix;
    })
    .join('\n');
}

export function writeContentToMarkdownFile(contents: FormattedText[], outputFilename: string): void {
  const markdownContent = formatAsMarkdown(contents, outputFilename);

  try {
    fs.writeFileSync(path.join("notion-pages", outputFilename), markdownContent); 
    console.log(`Markdown file ${outputFilename} has been saved successfully.`);
  } catch (err) {
    console.error(err);
  }
}

// (async () => {
//   const pages = await getAllPageIdsWithTitle();
//   // console.log(pageIds);
//   await Promise.all(pages.map(async (page) => {
//     const content = await getPageContent(page.id);
//     writeContentToMarkdownFile(content, page.title.replace(" ", "-").concat(".md"));
//   }))
// })();