import { supabase } from "@/lib/supabaseClient";

// Lists every file under a folder (folders are returned without an id),
// so a case's photos, videos and documents can be removed with it.
async function listAll(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) out.push(path);
    else out.push(...(await listAll(bucket, path, depth + 1)));
  }
  return out;
}

export async function collectCaseFiles(caseId: string) {
  const [media, documents] = await Promise.all([
    listAll("iconfam-media", caseId),
    listAll("iconfam-documents", caseId),
  ]);
  return { media, documents };
}

export async function removeCaseFiles(files: { media: string[]; documents: string[] }): Promise<number> {
  let failed = 0;
  for (const [bucket, paths] of [
    ["iconfam-media", files.media],
    ["iconfam-documents", files.documents],
  ] as const) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) failed += paths.slice(i, i + 100).length;
    }
  }
  return failed;
}
