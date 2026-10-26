/**
 * Generates TypeScript, Go, Java, and Python type definitions from JSON
 */

function capitalize(str: string): string {
  if (!str) return 'Item';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function jsonToTypeScript(json: any, rootName = 'RootObject'): string {
  if (json === null || typeof json !== 'object') {
    return `export type ${rootName} = ${typeof json};`;
  }

  const interfaces: string[] = [];

  function generateInterface(obj: any, name: string): string {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        const itemType = `${name}Item`;
        generateInterface(obj[0], itemType);
        return `export type ${name} = ${itemType}[];`;
      }
      return `export type ${name} = ${typeof (obj[0] || 'any')}[];`;
    }

    const fields: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
      if (val === null) {
        fields.push(`  ${safeKey}: any;`);
      } else if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          const subName = `${capitalize(toCamelCase(key))}Item`;
          generateInterface(val[0], subName);
          fields.push(`  ${safeKey}: ${subName}[];`);
        } else {
          const subType = val.length > 0 ? typeof val[0] : 'any';
          fields.push(`  ${safeKey}: ${subType}[];`);
        }
      } else if (typeof val === 'object') {
        const subName = capitalize(toCamelCase(key));
        generateInterface(val, subName);
        fields.push(`  ${safeKey}: ${subName};`);
      } else {
        fields.push(`  ${safeKey}: ${typeof val};`);
      }
    }

    const code = `export interface ${name} {\n${fields.join('\n')}\n}`;
    interfaces.push(code);
    return name;
  }

  generateInterface(json, rootName);
  return interfaces.join('\n\n');
}

export function jsonToGo(json: any, rootName = 'Root'): string {
  const structs: string[] = [];

  function generateStruct(obj: any, name: string): string {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        generateStruct(obj[0], `${name}Item`);
      }
      return '';
    }

    const fields: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const fieldName = capitalize(toCamelCase(key));
      let goType = 'interface{}';
      if (val === null) goType = 'interface{}';
      else if (typeof val === 'string') goType = 'string';
      else if (typeof val === 'number') goType = Number.isInteger(val) ? 'int' : 'float64';
      else if (typeof val === 'boolean') goType = 'bool';
      else if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object') {
          const subName = `${fieldName}Item`;
          generateStruct(val[0], subName);
          goType = `[]${subName}`;
        } else {
          const subType = val.length > 0 ? (typeof val[0] === 'number' ? 'int' : typeof val[0]) : 'interface{}';
          goType = `[]${subType}`;
        }
      } else if (typeof val === 'object') {
        const subName = fieldName;
        generateStruct(val, subName);
        goType = subName;
      }
      fields.push(`\t${fieldName} ${goType} \`json:"${key}"\``);
    }

    structs.push(`type ${name} struct {\n${fields.join('\n')}\n}`);
    return name;
  }

  generateStruct(json, rootName);
  return structs.join('\n\n');
}

export function jsonToJava(json: any, rootName = 'Root'): string {
  const records: string[] = [];

  function generateRecord(obj: any, name: string): string {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        generateRecord(obj[0], `${name}Item`);
      }
      return '';
    }

    const fields: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      let javaType = 'Object';
      if (typeof val === 'string') javaType = 'String';
      else if (typeof val === 'number') javaType = Number.isInteger(val) ? 'Integer' : 'Double';
      else if (typeof val === 'boolean') javaType = 'Boolean';
      else if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object') {
          const subName = `${capitalize(toCamelCase(key))}Item`;
          generateRecord(val[0], subName);
          javaType = `List<${subName}>`;
        } else {
          javaType = 'List<Object>';
        }
      } else if (typeof val === 'object' && val !== null) {
        const subName = capitalize(toCamelCase(key));
        generateRecord(val, subName);
        javaType = subName;
      }
      fields.push(`    ${javaType} ${toCamelCase(key)}`);
    }

    records.push(`public record ${name}(\n${fields.join(',\n')}\n) {}`);
    return name;
  }

  generateRecord(json, rootName);
  return 'import java.util.List;\n\n' + records.join('\n\n');
}

export function jsonToPython(json: any, rootName = 'Root'): string {
  const models: string[] = [];

  function generateModel(obj: any, name: string): string {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        generateModel(obj[0], `${name}Item`);
      }
      return '';
    }

    const fields: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      let pyType = 'Any';
      if (typeof val === 'string') pyType = 'str';
      else if (typeof val === 'number') pyType = Number.isInteger(val) ? 'int' : 'float';
      else if (typeof val === 'boolean') pyType = 'bool';
      else if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object') {
          const subName = `${capitalize(toCamelCase(key))}Item`;
          generateModel(val[0], subName);
          pyType = `List[${subName}]`;
        } else {
          pyType = 'List[Any]';
        }
      } else if (typeof val === 'object' && val !== null) {
        const subName = capitalize(toCamelCase(key));
        generateModel(val, subName);
        pyType = subName;
      }
      fields.push(`    ${key}: ${pyType}`);
    }

    models.push(`class ${name}(BaseModel):\n${fields.length > 0 ? fields.join('\n') : '    pass'}`);
    return name;
  }

  generateModel(json, rootName);
  return 'from typing import List, Any, Optional\nfrom pydantic import BaseModel\n\n' + models.join('\n\n');
}
