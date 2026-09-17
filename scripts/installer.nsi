; OmniGit Professional NSIS Setup Script
; Generates single-file setup installer: OmniGit-Setup-0.1.0.exe

Unicode true

!define PRODUCT_NAME "OmniGit"
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.3.0"
!endif
!define PRODUCT_PUBLISHER "OmniGit Team"
!define PRODUCT_WEB_SITE "https://github.com/BucanYu/OmniGit"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\OmniGit.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"

; User-level install: No UAC prompt, seamlessly supports silent auto-update
RequestExecutionLevel user

; Maximum LZMA Solid compression
SetCompressor /SOLID lzma

; Includes
!include "MUI2.nsh"
!include "FileFunc.nsh"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "..\app\build\icon.ico"
!define MUI_UNICON "..\app\build\icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\OmniGit.exe"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language (Modern UI 2 provides complete native Simplified Chinese and English translation)
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; Name and Output
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\app\release\OmniGit-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\OmniGit"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Section "MainSection" SEC01
  ; Terminate running OmniGit instance before installing/updating
  nsExec::Exec 'taskkill /F /IM OmniGit.exe /T'

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Copy all binary files from the packaged bundle
  File /r "..\app\release\OmniGit-win32-x64\*.*"

  ; Create Shortcuts (Explicitly point to icon.ico so Windows always displays our custom brand icon)
  CreateDirectory "$SMPROGRAMS\OmniGit"
  CreateShortcut "$SMPROGRAMS\OmniGit\OmniGit.lnk" "$INSTDIR\OmniGit.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\OmniGit\Uninstall OmniGit.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$DESKTOP\OmniGit.lnk" "$INSTDIR\OmniGit.exe" "" "$INSTDIR\icon.ico" 0

  ; Create Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Write Registry
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\OmniGit.exe"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\icon.ico,0"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoRepair" 1

  ; Calculate installed size for Windows Add/Remove Programs
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"

  ; Flush Windows Explorer icon cache so the new desktop icon appears immediately without reboot
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
SectionEnd

Section Uninstall
  ; Terminate running OmniGit instance before uninstalling
  nsExec::Exec 'taskkill /F /IM OmniGit.exe /T'

  ; Remove shortcuts
  Delete "$DESKTOP\OmniGit.lnk"
  Delete "$SMPROGRAMS\OmniGit\OmniGit.lnk"
  Delete "$SMPROGRAMS\OmniGit\Uninstall OmniGit.lnk"
  RMDir "$SMPROGRAMS\OmniGit"

  ; Remove registry
  DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"

  ; Remove application files
  RMDir /r "$INSTDIR"

  ; Flush Windows Explorer icon cache
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

  SetAutoClose true
SectionEnd
