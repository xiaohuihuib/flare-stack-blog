import { generateText, Output } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

export interface ModerationResult {
  safe: boolean;
  reason: string;
}

type WorkersAITextModel = Parameters<ReturnType<typeof createWorkersAI>>[0];

const TEXT_MODEL = "@cf/zai-org/glm-4.7-flash" satisfies WorkersAITextModel;

function buildSameLanguageDirective(options: {
  sourceDescription: string;
  outputDescription: string;
}) {
  return `语言要求：
- ${options.outputDescription}必须与${options.sourceDescription}的主要语言保持一致。
- 如果${options.sourceDescription}混合多种语言，优先使用占比最高、最主要的叙述语言；
- 不要把${options.sourceDescription}翻译成另一种语言，也不要额外说明你选择了什么语言。`;
}

export async function summarizeText(context: { env: Env }, text: string) {
  const workersAI = createWorkersAI({ binding: context.env.AI });

  const result = await generateText({
    model: workersAI(TEXT_MODEL),
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `你是一个专业的内容摘要生成助手。
请遵循以下规则：
${buildSameLanguageDirective({
  sourceDescription: "输入正文",
  outputDescription: "输出摘要",
})}
1. **长度限制**：控制在 200 字以内。
2. **内容要求**：直接输出摘要内容，不要包含"摘要："、"Summary:"、"本文讲了"等前缀或废话，保留核心观点。`,
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  return {
    summary: result.text.trim(),
  };
}

export async function generateTags(
  context: {
    env: Env;
  },
  content: {
    title: string;
    summary?: string;
    content?: string;
  },
  existingTags: Array<string> = [],
) {
  const workersAI = createWorkersAI({ binding: context.env.AI });

  const result = await generateText({
    model: workersAI(TEXT_MODEL),
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `你是一个**严格的**内容分类专家。你的任务是提取 1-3 个标签。

### 核心原则 (必须严格遵守)
1. **证据原则**：每一个选出的标签，必须能在文章中找到明确的讨论内容。如果只是文中顺口提了一句（例如作为背景提及），**不准**作为标签。
2. **禁止过度联想**：不要因为文章属于某个大类（如“编程”），就强行套用库里的热门标签（如 "Java"、"Python"），除非文中真的在讲它们。
3. **现有标签使用规则**：
   - 检查"已存在标签列表"。
   - **仅当**现有标签与文章核心内容**完全精准匹配**，且标签语言与文章主语言一致时，才使用它。
   - 如果现有标签都与文章核心无关，**请完全忽略该列表**，直接生成新的精准标签。
4. **宁缺毋滥**：如果文章很短或内容模糊，生成 1-2 个最准的即可，不要凑数。
${buildSameLanguageDirective({
  sourceDescription: "文章内容",
  outputDescription: "输出标签",
})}
- 不要为了复用现有标签而跨语言翻译、硬套或改写标签。

请直接输出结果，无需解释。`,
      },
      {
        role: "user",
        content: `### 已存在的标签列表(仅在精准匹配时使用，否则忽略):
${JSON.stringify(existingTags)}

### 待分析文章:
文章标题：${content.title}
文章摘要：${content.summary || "无"}
文章内容预览：
${content.content ? content.content.slice(0, 8000) : "无"}
...`,
      },
    ],
    output: Output.object({
      schema: z.object({
        tags: z.array(z.string()).describe("生成的标签列表"),
      }),
    }),
  });

  return [...new Set(result.output.tags)];
}
