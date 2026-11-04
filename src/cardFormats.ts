import YAML from 'yaml';
import Papa from 'papaparse';
import { Thought, ThoughtStatus, ThoughtType } from './types';
import type { ImportCard } from './repository';

export type ImportFile = { name: string; text: string };
function parseList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (value.trim().startsWith('[')) {
    try { const result=JSON.parse(value); if (Array.isArray(result) && result.every(v=>typeof v==='string')) return result; } catch { /* A plain name may begin with a bracket. */ }
  }
  return value.split(';');
}

export function parseCardFiles(files: ImportFile[]): ImportCard[] {
  return files.flatMap(({name,text})=>{
    if (/\.csv$/i.test(name)) {
      const result=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:true,delimiter:','});
      if (result.errors.length) throw new Error(`${name}: ${result.errors[0].message}`);
      return result.data.map(row=>({id:row.id?.trim() || undefined,title:row.title?.trim() || undefined,summary:row.summary,content:row.content,type:(row.type?.trim() || undefined) as ThoughtType | undefined,status:(row.status?.trim() || undefined) as ThoughtStatus | undefined,tags:parseList(row.tags),decks:parseList(row.decks)}));
    }
    if (!/\.md$/i.test(name)) throw new Error(`${name} 不是 Markdown 或 CSV 文件`);
    const match=text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
    if (!match) throw new Error(`${name} 需要以 YAML front matter 开头`);
    const meta=YAML.parse(match[1]);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error(`${name} 的 YAML 头部无效`);
    return [{id:meta.id || undefined,title:meta.title,summary:meta.summary,content:match[2],type:meta.type,status:meta.status,tags:meta.tags,decks:meta.decks}];
  });
}

export function formatMarkdown(thought: Thought, tags: string[], decks: string[]) {
  const metadata=YAML.stringify({id:thought.id,title:thought.title,type:thought.type,status:thought.status,summary:thought.summary,tags,decks});
  return `---\n${metadata}---\n${thought.content}`;
}

export function formatCsv(cards: Array<{thought: Thought; tags:string[]; decks:string[]}>) {
  return Papa.unparse({fields:['id','title','summary','content','type','status','tags','decks'],data:cards.map(({thought,tags,decks})=>[thought.id,thought.title,thought.summary,thought.content,thought.type,thought.status,JSON.stringify(tags),JSON.stringify(decks)])});
}
