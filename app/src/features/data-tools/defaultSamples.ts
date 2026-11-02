import type { DataFormat } from './types';

export const DEFAULT_SAMPLE_JSON = JSON.stringify(
  {
    code: 200,
    message: 'success',
    data: {
      workspace: 'OmniGit Production Hub',
      version: '0.6.1',
      activeProjects: [
        {
          id: 101,
          name: 'cloud-gateway-service',
          status: 'running',
          port: 8080,
          tags: ['microservice', 'gateway', 'spring-cloud'],
          metrics: { cpu: 12.5, memoryMb: 512, qps: 1420 },
        },
        {
          id: 102,
          name: 'user-auth-service',
          status: 'running',
          port: 8081,
          tags: ['microservice', 'auth', 'jwt'],
          metrics: { cpu: 8.2, memoryMb: 384, qps: 890 },
        },
        {
          id: 103,
          name: 'frontend-portal-web',
          status: 'stopped',
          port: 3000,
          tags: ['frontend', 'react', 'vite'],
          metrics: { cpu: 0, memoryMb: 0, qps: 0 },
        },
      ],
      featuresEnabled: {
        autoSync: true,
        antiRceSandbox: true,
        interactiveCodeFolding: true,
      },
    },
    timestamp: 1793000000000,
  },
  null,
  2
);

export const DEFAULT_SAMPLE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: omnigit-core-service
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: omnigit-core
  template:
    metadata:
      labels:
        app: omnigit-core
    spec:
      containers:
        - name: core
          image: omnigit/engine:0.6.1
          ports:
            - containerPort: 5345`;

export const DEFAULT_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.omnigit</groupId>
  <artifactId>omnigit-server</artifactId>
  <version>0.6.1</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>`;

export const DEFAULT_SAMPLE_SQL = `SELECT u.id, u.username, u.email, count(c.id) AS total_commits FROM users u LEFT JOIN commits c ON u.id = c.author_id WHERE u.status = 'ACTIVE' AND c.created_at >= '2026-01-01' GROUP BY u.id, u.username, u.email HAVING count(c.id) > 10 ORDER BY total_commits DESC LIMIT 50;`;

export const DEFAULT_SAMPLE_JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsZXggRGV2Iiwicm9sZXMiOlsic3VwZXJfYWRtaW4iLCJkZXZlbG9wZXIiXSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3OTMwMDAwMDB9.signature_placeholder`;

export const DEFAULT_SAMPLE_URL = `https://api.omnigit.dev/v1/repositories?workspace=ws_1789&filter=active&sort=updated_desc&page=1&pageSize=20&tags=java&tags=react`;

export const DEFAULT_SAMPLE_BASE64 = 'T21uaUdpdCBEYXRhIFRvb2xzIC0gQmFzZTY0IHNhbXBsZSBwYXlsb2Fk';

export const DEFAULT_SAMPLE_TIMESTAMP = `now
1793000000
1793000000000
2026-11-02T10:30:00+08:00`;

export const DEFAULT_SAMPLE_HASH = `OmniGit Offline Crypto & UUID Workspace`;

export const DEFAULT_SAMPLE_REGEX = `/(?<protocol>https?):\\/\\/(?<host>[\\w.-]+)(?::(?<port>\\d+))?(?<path>\\/[\\w./-]*)?/gi
Gateway: https://api.omnigit.dev:8443/v1/repos
Webhook: http://localhost:5345/api/git/status
Docs: https://docs.omnigit.dev/guide/quickstart`;

export const DEFAULT_SAMPLES: Record<DataFormat, string> = {
  json: DEFAULT_SAMPLE_JSON,
  yaml: DEFAULT_SAMPLE_YAML,
  xml: DEFAULT_SAMPLE_XML,
  sql: DEFAULT_SAMPLE_SQL,
  jwt: DEFAULT_SAMPLE_JWT,
  url: DEFAULT_SAMPLE_URL,
  base64: DEFAULT_SAMPLE_BASE64,
  timestamp: DEFAULT_SAMPLE_TIMESTAMP,
  hash: DEFAULT_SAMPLE_HASH,
  regex: DEFAULT_SAMPLE_REGEX,
};

export const FORMAT_METAS: {
  id: DataFormat;
  label: string;
  badge: string;
  defaultTitle: string;
  desc: string;
}[] = [
  { id: 'json', label: 'JSON / JSON5', badge: '{ }', defaultTitle: 'JSON', desc: '键值结构 / 接口响应' },
  { id: 'yaml', label: 'YAML', badge: 'yml', defaultTitle: 'YAML', desc: '配置文件 / Kubernetes' },
  { id: 'xml', label: 'XML / HTML', badge: '< >', defaultTitle: 'XML', desc: '标记文档 / DOM 树' },
  { id: 'sql', label: 'SQL', badge: 'sql', defaultTitle: 'SQL', desc: '数据库查询 / DDL 脚本' },
  { id: 'jwt', label: 'JWT Token', badge: 'jwt', defaultTitle: 'JWT', desc: '鉴权令牌 / Claims' },
  { id: 'url', label: 'URL Query', badge: 'url', defaultTitle: 'URL', desc: 'URL 查询参数 / 键值对' },
  { id: 'base64', label: 'Base64', badge: 'b64', defaultTitle: 'Base64', desc: '文本编解码 / 字节分析' },
  { id: 'timestamp', label: 'Timestamp', badge: 'time', defaultTitle: 'Time', desc: '时间戳 / ISO 日期互转' },
  { id: 'hash', label: 'UUID & Hash', badge: 'hash', defaultTitle: 'Hash', desc: 'SHA256 / CRC32 / UUIDv4' },
  { id: 'regex', label: 'Regex Tester', badge: 're', defaultTitle: 'Regex', desc: '正则匹配 / 命名捕获组分析' },
];
