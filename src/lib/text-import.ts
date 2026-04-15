const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

function deriveProjectName(filename: string) {
  return filename.replace(/\.txt$/i, '').trim() || '未命名项目';
}

function looksLikePlainText(content: string) {
  return !CONTROL_CHARACTER_PATTERN.test(content);
}

async function readFileContent(file: File) {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取 txt 文件失败'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('读取 txt 文件失败'));
    };
    reader.readAsText(file);
  });
}

export async function readImportedTextFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('目前只支持导入 .txt 纯文本文件');
  }

  const content = await readFileContent(file);

  if (!content.trim()) {
    throw new Error('导入的 txt 文件为空');
  }

  if (!looksLikePlainText(content)) {
    throw new Error('导入的文件不像可读取的纯文本内容');
  }

  return {
    content,
    suggestedName: deriveProjectName(file.name)
  };
}
