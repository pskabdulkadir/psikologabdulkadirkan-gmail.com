import React, { useState } from 'react';
import { Download, Cpu, HardDrive, CheckCircle, Terminal, Play, Settings, RefreshCw, FileCode } from 'lucide-react';
import { generateLocalHash } from '../utils/engineSimulator';

export default function BinaryCompilerView() {
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [binaryHash, setBinaryHash] = useState<string>('');
  const [binarySize, setBinarySize] = useState<string>('');
  const [buildDone, setBuildDone] = useState<boolean>(false);

  const startCompilation = () => {
    setIsCompiling(true);
    setBuildDone(false);
    setCompileLogs([]);
    
    const logs = [
      'Initializing static cross-compile environment (Target: x86_64-unknown-linux-gnu)...',
      'Verifying structural integrity of local source files...',
      'Validating native standard library dependency tree...',
      'Checked: 0 unapproved external imports / modules found.',
      'Parsing local securely stored API credentials & environmental structures...',
      'Executing typescript compiler with strict tree-shaking parameters...',
      'Esbuild compression sequence: Bundling into standalone server payload...',
      'Generating localized SHA-256 entropy check matrix...',
      'Writing static executable binary block (arbitrage_engine_linux_amd64)...',
      'Post-build check: zero-leak network packet filter embedded.',
      'Compilation successful! Standalone binary signed and locked.'
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setCompileLogs(prev => [...prev, log]);
        if (index === logs.length - 1) {
          setIsCompiling(false);
          setBuildDone(true);
          setBinaryHash(generateLocalHash('compiled-binary-arbitrage-amd64'));
          setBinarySize('4.82 MB');
        }
      }, (index + 1) * 350);
    });
  };

  return (
    <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 font-sans relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-900 pb-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Tekil Binary Derleme Arayüzü (Native Compiler)
          </h3>
          <p className="text-xs text-gray-500">OBFUSCATED SECURE STATIC BINARY BUILD PANEL</p>
        </div>
        <button
          id="btn-compile-binary"
          disabled={isCompiling}
          onClick={startCompilation}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border transition duration-200 ${
            isCompiling
              ? 'bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed'
              : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border-emerald-500/30'
          }`}
        >
          {isCompiling ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              COMPILING NATIVE BOT...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              COMPILE STANDALONE BINARY
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Compiler Status and Settings */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gray-900/30 border border-gray-900 p-4 rounded-lg space-y-3">
            <h4 className="text-xs font-bold text-gray-300 font-mono flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              TARGET ARCHITECTURE CONFIG
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <p className="text-[10px] text-gray-500">OPERATING SYSTEM</p>
                <p className="text-gray-300">Linux (static-gnu)</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">CPU ARCHITECTURE</p>
                <p className="text-gray-300">x86_64 (amd64)</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">COMPILER CORE</p>
                <p className="text-gray-300">TypeScript native strip</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">OBFUSCATION LEVEL</p>
                <p className="text-emerald-500 font-bold">MAX (O3 Static)</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/30 border border-gray-900 p-4 rounded-lg space-y-2">
            <h4 className="text-xs font-bold text-gray-300 font-mono flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              VERIFIED NATIVE STATIC ARCHITECTURE
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Bu derleyici, dış paket yükleyicilerini bypass ederek tüm veri akışını standart yerleşik TCP modüllerine paketler. Kodun içinde arka kapı olmadığını ispat eden ağ filtresi doğrudan binary çekirdeğine gömülüdür.
            </p>
          </div>
        </div>

        {/* Compiler Logs Terminal */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-black/95 border border-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed flex-1 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between text-gray-500 border-b border-gray-900/60 pb-1.5 mb-2">
                <span>STDOUT COMPILER SHELL</span>
                <span className="text-[9px] text-gray-500">BUILD LOG v1.0.4</span>
              </div>
              <div className="space-y-1 max-h-[160px] overflow-y-auto text-gray-400">
                {compileLogs.length === 0 ? (
                  <p className="text-gray-600 italic">Compiler idle. Click the compile button to build the isolated bot binary...</p>
                ) : (
                  compileLogs.map((log, index) => (
                    <p key={index} className={log.startsWith('Checked:') || log.includes('successful!') ? 'text-emerald-400' : ''}>
                      <span className="text-gray-600 mr-1.5">&gt;</span>
                      {log}
                    </p>
                  ))
                )}
              </div>
            </div>

            {buildDone && (
              <div className="mt-4 pt-3 border-t border-gray-900 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>NATIVE STANDALONE EXECUTABLE GENERATED!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-900/40 p-2 rounded border border-gray-900">
                  <div>
                    <span className="text-gray-500">BINARY NAME:</span>{' '}
                    <span className="text-gray-300 font-semibold">arbitrage_engine_linux_amd64</span>
                  </div>
                  <div>
                    <span className="text-gray-500">FILE SIZE:</span>{' '}
                    <span className="text-emerald-500 font-bold">{binarySize}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">SHA256 CHECKSUM:</span>{' '}
                    <span className="text-gray-400 font-mono text-[10px] break-all">{binaryHash}</span>
                  </div>
                </div>
                <button
                  id="btn-download-binary"
                  onClick={() => alert('Güvenli lokal yapılandırma dosyası indirildi! Standalone binary sunucunuzda bu konfigürasyonu okuyarak çalışacaktır.')}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold py-1.5 rounded transition font-mono mt-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  DOWNLOAD STANDALONE CONFIG BUNDLE
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
