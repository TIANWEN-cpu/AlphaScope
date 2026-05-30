; 研策中枢 AlphaScope Inno Setup 安装脚本
;
; 使用方式:
;   1. 先运行 python build.py 生成 dist/AlphaScope/
;   2. 用 Inno Setup 6 打开此文件
;   3. 点击 编译 → 生成安装包
;
; 输出: installer-output/AlphaScope-Setup.exe

#define MyAppName "AlphaScope"
#define MyAppNameCN "研策中枢 AlphaScope"
#define MyAppVersion "0.38"
#define MyAppPublisher "TIANWEN"
#define MyAppURL "https://github.com/TIANWEN-cpu/AlphaScope"
#define MyAppExeName "AlphaScope.exe"

; PyInstaller 输出目录（build.py 的输出）
#define SourceDir "..\dist\AlphaScope"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppNameCN}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=installer-output
OutputBaseFilename=AlphaScope-Setup-{#MyAppVersion}
SetupIconFile=
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppNameCN} 安装程序
VersionInfoProductName={#MyAppName}

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1

[Files]
; 主程序目录（PyInstaller onedir 输出）
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
; 用户数据目录（卸载时保留）
Name: "{app}\cache"; Flags: uninsneveruninstall
Name: "{app}\cache\fundamentals"; Flags: uninsneveruninstall
Name: "{app}\cache\chroma_db"; Flags: uninsneveruninstall
Name: "{app}\reports"; Flags: uninsneveruninstall
Name: "{app}\reports\archive"; Flags: uninsneveruninstall
Name: "{app}\uploads"; Flags: uninsneveruninstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\使用说明"; Filename: "{app}\使用说明.txt"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; 首次安装后可选启动
Filename: "{app}\{#MyAppExeName}"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
// 首次运行时提示配置 .env
procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: string;
  EnvExample: string;
begin
  if CurStep = ssPostInstall then
  begin
    EnvFile := ExpandConstant('{app}\.env');
    EnvExample := ExpandConstant('{app}\.env.example');
    // 如果 .env 不存在，从 .env.example 复制
    if not FileExists(EnvFile) and FileExists(EnvExample) then
    begin
      FileCopy(EnvExample, EnvFile, False);
      MsgBox('安装完成！' + #13#10 + #13#10 +
             '首次使用请编辑 .env 文件配置 API Key：' + #13#10 +
             EnvFile + #13#10 + #13#10 +
             '至少需要配置 DEEPSEEK_API_KEY 才能使用。',
             mbInformation, MB_OK);
    end;
  end;
end;

// 卸载确认
function InitializeUninstall(): Boolean;
begin
  Result := MsgBox('确定要卸载 {#MyAppName} 吗？' + #13#10 + #13#10 +
                   '用户数据（cache/, reports/, .env）将被保留。',
                   mbConfirmation, MB_YESNO) = IDYES;
end;
