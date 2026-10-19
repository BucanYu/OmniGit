import type { ServicePresetTemplate } from './types';

export const SERVICE_PRESET_TEMPLATES: ServicePresetTemplate[] = [
  {
    key: 'nodeDev',
    defaultName: 'Frontend Web',
    winCommand: 'npm run dev',
    unixCommand: 'npm run dev',
    cwdPlaceholder: '',
  },
  {
    key: 'springMaven',
    defaultName: 'Spring Boot (Maven)',
    winCommand: 'mvn.cmd spring-boot:run',
    unixCommand: './mvnw spring-boot:run',
    cwdPlaceholder: '',
  },
  {
    key: 'springGradle',
    defaultName: 'Spring Boot (Gradle)',
    winCommand: 'gradlew.bat bootRun',
    unixCommand: './gradlew bootRun',
    cwdPlaceholder: '',
  },
  {
    key: 'pythonWeb',
    defaultName: 'Python Web',
    winCommand: 'python -m uvicorn main:app --reload',
    unixCommand: 'python3 -m uvicorn main:app --reload',
    cwdPlaceholder: '',
  },
  {
    key: 'goRun',
    defaultName: 'Go Server',
    winCommand: 'go run .',
    unixCommand: 'go run .',
    cwdPlaceholder: '',
  },
  {
    key: 'dockerCompose',
    defaultName: 'Docker Compose',
    winCommand: 'docker compose up',
    unixCommand: 'docker compose up',
    cwdPlaceholder: '',
  },
  {
    key: 'custom',
    defaultName: 'My Service',
    winCommand: 'npm start',
    unixCommand: './run.sh',
    cwdPlaceholder: '',
  },
];
