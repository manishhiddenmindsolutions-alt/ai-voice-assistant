import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Trash2, 
  UploadCloud, 
  AlertCircle, 
  ArrowLeft, 
  BookOpen, 
  Loader2
} from 'lucide-react';
import { agentApi, knowledgeApi } from '../services/api';
import toast from 'react-hot-toast';

interface KnowledgeDoc {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

const AgentKnowledgePage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<any>(null);
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!agentId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [agentRes, docRes] = await Promise.all([
          agentApi.get(agentId),
          knowledgeApi.list(agentId)
        ]);
        setAgent(agentRes.data);
        setDocuments(docRes.data || []);
      } catch (err) {
        console.error('Failed to load knowledge base:', err);
        toast.error('Failed to sync knowledge base registry');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [agentId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!agentId) return;
    
    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'txt') {
      toast.error('Only PDF (.pdf) and Text (.txt) files are supported.');
      return;
    }

    // Limit to 15MB
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds the 15MB limit.');
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading and indexing "${file.name}"...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await knowledgeApi.upload(agentId, formData);
      setDocuments((prev) => [resp.data, ...prev]);
      toast.success('Document uploaded and indexed successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Upload failed:', err);
      const detail = err.response?.data?.detail || 'Failed to upload and index document';
      toast.error(detail, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will remove its vector indices.`)) {
      return;
    }

    const toastId = toast.loading(`Removing "${filename}"...`);
    try {
      await knowledgeApi.delete(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Document deleted successfully', { id: toastId });
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete document', { id: toastId });
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 animate-in fade-in duration-300">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
        <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider">Syncing knowledge base...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500 font-sans relative z-10">
      
      {/* HEADER SECTION (GLASS BANNER) */}
      <div className="relative p-6 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--surface-secondary)]/20 to-[var(--surface)]/10 shadow-sm backdrop-blur-md overflow-hidden mb-8">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[var(--primary)]/5 dark:bg-[var(--primary)]/8 blur-[80px] pointer-events-none z-0" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              <span className="cursor-pointer hover:text-[var(--text-primary)]" onClick={() => navigate(`/agent/${agentId}/overview`)}>
                {agent?.agentName || 'Agent'}
              </span>
              <span>/</span>
              <span className="text-[var(--text-secondary)] font-bold">Knowledge Base</span>
            </div>
            
            <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Knowledge Base RAG System
            </h1>
            <p className="text-xs mt-1 max-w-[850px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Provide reference documents, client manuals, PDF guides, or text databases. 
              The agent searches and reads this indexed information in real time to resolve complex queries accurately.
            </p>
          </div>

          <button 
            onClick={() => navigate(`/agent/${agentId}/overview`)}
            className="btn-outline h-9 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg active:scale-[0.98] shrink-0"
          >
            <ArrowLeft size={14} />
            Agent Dashboard
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SYSTEM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Uploader */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card p-6 space-y-6 shadow-md rounded-2xl bg-[var(--card-bg)] border-[var(--border)] hover:border-[var(--border-hover)] transition-all">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3.5">
              <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
                <UploadCloud size={18} />
              </div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">Upload Reference Files</h2>
            </div>

            <form 
              onDragEnter={handleDrag} 
              onDragOver={handleDrag} 
              onDragLeave={handleDrag} 
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl text-center min-h-[220px] transition-all cursor-pointer ${
                dragActive 
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-inner scale-[1.01]' 
                  : 'border-[var(--border)] bg-[var(--surface-secondary)]/10 hover:bg-[var(--surface-secondary)]/20'
              }`}
            >
              <input 
                type="file" 
                id="file-upload-input" 
                multiple={false} 
                accept=".pdf,.txt" 
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden" 
              />
              
              <UploadCloud size={36} className="text-[var(--text-muted)] mb-3 animate-pulse" />
              
              <p className="text-xs font-bold text-[var(--text-primary)]">
                Drag & drop your file here, or{' '}
                <label 
                  htmlFor="file-upload-input" 
                  className="text-[var(--primary)] cursor-pointer hover:underline"
                >
                  browse computer
                </label>
              </p>
              
              <p className="text-[9px] text-[var(--text-muted)] font-semibold mt-1">
                Supports PDF (.pdf) and Text (.txt) files up to 15MB.
              </p>
              
              {uploading && (
                <div className="absolute inset-0 bg-[var(--background)]/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-3">
                  <Loader2 size={28} className="text-[var(--primary)] animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-extrabold text-[var(--text-primary)]">Indexing Document...</p>
                    <p className="text-[9px] text-[var(--text-muted)] font-mono mt-0.5">Creating semantic vectors & storing in Qdrant</p>
                  </div>
                </div>
              )}
            </form>

            {/* TIP BOX */}
            <div className="flex gap-3 p-4 rounded-xl border border-[var(--primary)]/10 bg-[var(--primary)]/5 dark:bg-[var(--primary)]/5">
              <AlertCircle size={18} className="text-[var(--primary)] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--primary)]">How RAG Works</span>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  When a client asks the agent a question, the agent executes a semantic search across your uploaded documents. Relevant context chunks are retrieved and injected directly into the LLM context to ensure accurate, grounded responses.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Document List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card p-6 space-y-5 shadow-md rounded-2xl bg-[var(--card-bg)] border-[var(--border)] hover:border-[var(--border-hover)] transition-all min-h-[350px] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                  <BookOpen size={18} />
                </div>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">Indexed Documents</h2>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-secondary)]">
                {documents.length} File{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[var(--surface-secondary)]/40 flex items-center justify-center border border-[var(--border)]">
                  <FileText size={20} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-secondary)]">No reference materials added yet.</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Upload files on the left to train your voice assistant.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex-1 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/15 hover:bg-[var(--surface-secondary)]/30 hover:border-[var(--primary)]/20 transition-all group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                            doc.file_type === 'pdf' 
                              ? 'border-red-500/20 bg-red-500/10 text-red-400' 
                              : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                          }`}>
                            {doc.file_type}
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] font-bold">{formatBytes(doc.file_size)}</span>
                          <span className="text-[9px] text-[var(--text-muted)]">•</span>
                          <span className="text-[9px] text-[var(--text-muted)] font-bold">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                      title="Delete document"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default AgentKnowledgePage;
