import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../utils/supabaseClient';
import { Archive, Plus, X, Search, Lock, Trash2, Loader2, Edit3, Download, LogIn, LogOut, ArrowRightLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

interface MoldInShelf {
  uuid?: string;
  mold_id: string;
  mold_size: string;
  quantity: number;
  scanned_in_at?: string;
  last_scan_out_at?: string; // Latest scan OUT from shelf (last time mold left shelf)
}

interface ShelfScanLog {
  mold_id: string;
  mold_size: string;
  action_type: 'IN' | 'OUT';
  created_at: string;
  machine_id: string;
}


interface Shelf {
  id: string;
  name: string;
  max_molds: number;
  status: string;
  molds: MoldInShelf[];
}

export function MoldShelfDatabase() {
  const { t } = useLanguage();
  
  // Real-time states
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Search mold highlighting
  const [moldHighlightQuery, setMoldHighlightQuery] = useState('');

  // Authentication state (shared for admin actions)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Shelf detail modals
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Stock edit states (inside detail view)
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [editingMolds, setEditingMolds] = useState<MoldInShelf[]>([]);
  const [isSavingStock, setIsSavingStock] = useState(false);

  // Add Shelf modal
  const [isAddShelfOpen, setIsAddShelfOpen] = useState(false);
  const [newShelfId, setNewShelfId] = useState('');
  const [newShelfName, setNewShelfName] = useState('');
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);

  // Shelf scan log timestamps (for last scan in/out per mold per shelf)
  const [shelfScanLogs, setShelfScanLogs] = useState<ShelfScanLog[]>([]);

  // Transfer mold between shelves
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferMold, setTransferMold] = useState<MoldInShelf | null>(null);
  const [transferTargetShelfId, setTransferTargetShelfId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [isTransferring, setIsTransferring] = useState(false);

  // Autocomplete states
  const [moldMasterList, setMoldMasterList] = useState<{ id: string; size: string }[]>([]);
  const [focusedRowIdx, setFocusedRowIdx] = useState<number | null>(null);

  // Load and subscribe
  useEffect(() => {
    fetchData();
    fetchMoldMasters();

    // Subscribe to machines (shelves) and running_molds changes
    const channel = supabase
      .channel('shelf_database_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'running_molds' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync selected shelf data when master shelves change (e.g. from real-time scans)
  useEffect(() => {
    if (selectedShelf) {
      const updated = shelves.find(s => s.id === selectedShelf.id);
      if (updated) {
        setSelectedShelf(updated);
        if (!isEditingStock) {
          setEditingMolds(updated.molds.map(m => ({ ...m })));
        }
      }
    }
  }, [shelves, selectedShelf, isEditingStock]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Fetch machines (shelves)
      const { data: machinesData, error: mErr } = await supabase
        .from('machines')
        .select('*')
        .order('id', { ascending: true });
      if (mErr) throw mErr;

      // Filter to only shelves (IDs starting with SHELF-)
      const shelfMachines = (machinesData || []).filter(m => m.id.startsWith('SHELF-'));

      // Fetch running molds on shelves
      const shelfIds = shelfMachines.map(s => s.id);
      let runningData: any[] = [];

      if (shelfIds.length > 0) {
        const { data: rData, error: rErr } = await supabase
          .from('running_molds')
          .select('*')
          .in('machine_id', shelfIds);
        if (rErr) throw rErr;
        runningData = rData || [];
      }

      // Map running molds to shelves
      const mappedShelves: Shelf[] = shelfMachines.map(m => {
        const moldsInThisShelf = runningData
          .filter(r => r.machine_id === m.id)
          .map(r => ({
            uuid: r.uuid,
            mold_id: r.mold_id,
            mold_size: r.mold_size,
            quantity: r.quantity,
            scanned_in_at: r.scanned_in_at
          }));

        return {
          id: m.id,
          name: m.name,
          max_molds: m.max_molds || 9999,
          status: m.status || 'optimal',
          molds: moldsInThisShelf
        };
      });

      setShelves(mappedShelves);

      // Also fetch shelf scan logs for last IN/OUT timestamps
      if (shelfIds.length > 0) {
        fetchShelfScanLogs(shelfIds);
      }
    } catch (err) {
      console.error('Error fetching shelf database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMoldMasters = async () => {
    try {
      let allMoldsData: {id: string, size: string}[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('mold_master')
          .select('id, size')
          .order('id')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error || !data || data.length === 0) break;
        allMoldsData = [...allMoldsData, ...data];
        if (data.length < pageSize) break;
        page++;
      }
      setMoldMasterList(allMoldsData);
    } catch (err) {
      console.error('Error loading mold masters:', err);
    }
  };

  // Fetch recent scan_logs for shelf IDs to determine last scan IN/OUT timestamps per mold
  const fetchShelfScanLogs = async (shelfIds: string[]) => {
    try {
      // Fetch recent scan_logs where machine_id is one of the shelf IDs
      // We get last 500 records to cover recent activity
      const { data, error } = await supabase
        .from('scan_logs')
        .select('machine_id, mold_id, mold_size, action_type, created_at')
        .in('machine_id', shelfIds)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setShelfScanLogs((data || []) as ShelfScanLog[]);
    } catch (err) {
      console.error('Error fetching shelf scan logs:', err);
    }
  };

  // Helper: get last scan IN timestamp for a mold on a shelf from scan_logs
  const getLastScanIn = (shelfId: string, moldId: string, moldSize: string, fallbackScannedIn?: string): string | undefined => {
    const log = shelfScanLogs.find(
      l => l.machine_id === shelfId && l.mold_id === moldId && l.mold_size === moldSize && l.action_type === 'IN'
    );
    return log?.created_at || fallbackScannedIn;
  };

  // Helper: get last scan OUT timestamp for a mold on a shelf from scan_logs
  const getLastScanOut = (shelfId: string, moldId: string, moldSize: string): string | undefined => {
    const log = shelfScanLogs.find(
      l => l.machine_id === shelfId && l.mold_id === moldId && l.mold_size === moldSize && l.action_type === 'OUT'
    );
    return log?.created_at;
  };

  // Xuất Excel báo cáo lịch sử di chuyển toàn bộ khuôn
  const handleExportMovementHistoryExcel = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch all mold masters
      let allMoldsData: {id: string, size: string}[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('mold_master')
          .select('id, size')
          .order('id')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error || !data || data.length === 0) break;
        allMoldsData = [...allMoldsData, ...data];
        if (data.length < pageSize) break;
        page++;
      }

      // 2. Fetch all shelves to map IDs to Names
      const { data: shelfMachines, error: mErr } = await supabase
        .from('machines')
        .select('id, name')
        .like('id', 'SHELF-%');
      if (mErr) throw mErr;
      const shelfMap = Object.fromEntries((shelfMachines || []).map(s => [s.id, s.name]));

      // 3. Fetch all running molds on shelves to determine current shelf storage
      const { data: runningOnShelves, error: rErr } = await supabase
        .from('running_molds')
        .select('machine_id, mold_id, mold_size, quantity')
        .like('machine_id', 'SHELF-%');
      if (rErr) throw rErr;

      // Group current shelf storage by mold_id + mold_size
      const currentStorageMap = new Map<string, string>();
      (runningOnShelves || []).forEach(r => {
        const key = `${r.mold_id}|${r.mold_size}`;
        const shelfName = shelfMap[r.machine_id] || r.machine_id;
        const info = `${shelfName} (x${r.quantity})`;
        if (currentStorageMap.has(key)) {
          currentStorageMap.set(key, `${currentStorageMap.get(key)}, ${info}`);
        } else {
          currentStorageMap.set(key, info);
        }
      });

      // 4. Fetch all scan logs for shelves to find the latest IN and OUT
      // Get up to 5000 logs to ensure quick download
      let allLogs: any[] = [];
      let logPage = 0;
      const logPageSize = 1000;
      while (logPage < 5) {
        const { data, error } = await supabase
          .from('scan_logs')
          .select('machine_id, mold_id, mold_size, action_type, created_at')
          .like('machine_id', 'SHELF-%')
          .order('created_at', { ascending: false })
          .range(logPage * logPageSize, (logPage + 1) * logPageSize - 1);
        
        if (error || !data || data.length === 0) break;
        allLogs = [...allLogs, ...data];
        if (data.length < logPageSize) break;
        logPage++;
      }

      // Map to keep track of latest scan IN and OUT per mold_id + mold_size
      const latestInMap = new Map<string, { time: string, shelf: string }>();
      const latestOutMap = new Map<string, { time: string, shelf: string }>();

      allLogs.forEach(log => {
        const key = `${log.mold_id}|${log.mold_size}`;
        const shelfName = shelfMap[log.machine_id] || log.machine_id;
        if (log.action_type === 'IN' && !latestInMap.has(key)) {
          latestInMap.set(key, { time: log.created_at, shelf: shelfName });
        } else if (log.action_type === 'OUT' && !latestOutMap.has(key)) {
          latestOutMap.set(key, { time: log.created_at, shelf: shelfName });
        }
      });

      // 5. Build export data row by row
      const exportData = allMoldsData.map(mold => {
        const key = `${mold.id}|${mold.size}`;
        const currentShelf = currentStorageMap.get(key) || 'Trống (Không có trên kệ)';
        
        const latestIn = latestInMap.get(key);
        const latestOut = latestOutMap.get(key);

        return {
          'Mã Khuôn (Mold ID)': mold.id,
          'Size Khuôn (Mold Size)': mold.size,
          'Kệ hiện tại đang lưu trữ': currentShelf,
          'Kệ scan in gần nhất': latestIn ? latestIn.shelf : '',
          'Ngày giờ scan in gần nhất': latestIn ? new Date(latestIn.time).toLocaleString('vi-VN') : '',
          'Kệ scan out gần nhất': latestOut ? latestOut.shelf : '',
          'Ngày giờ scan out gần nhất': latestOut ? new Date(latestOut.time).toLocaleString('vi-VN') : ''
        };
      });

      // 6. Generate Excel file
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-fit column widths
      const maxLens = exportData.reduce((acc, row) => {
        Object.entries(row).forEach(([col, val]) => {
          const valStr = String(val || '');
          acc[col] = Math.max(acc[col] || col.length, valStr.length);
        });
        return acc;
      }, {} as Record<string, number>);
      ws['!cols'] = Object.keys(maxLens).map(col => ({ wch: Math.min(50, maxLens[col] + 3) }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lich_Su_Di_Chuyen_Khuon');
      XLSX.writeFile(wb, `Lich_Su_Di_Chuyen_Khuon_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      console.error(err);
      alert('Lỗi xuất báo cáo lịch sử di chuyển: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = shelves.flatMap(shelf => {
        if (shelf.molds.length === 0) {
          return [{
            'Mã Kệ (Shelf ID)': shelf.id,
            'Tên Kệ (Shelf Name)': shelf.name,
            'Mã Khuôn (Mold ID)': 'Kệ trống',
            'Size Khuôn (Mold Size)': '',
            'Số lượng (Quantity)': 0,
            'Thời gian đưa vào kệ (Scanned In)': ''
          }];
        }
        return shelf.molds.map(mold => ({
          'Mã Kệ (Shelf ID)': shelf.id,
          'Tên Kệ (Shelf Name)': shelf.name,
          'Mã Khuôn (Mold ID)': mold.mold_id,
          'Size Khuôn (Mold Size)': mold.mold_size,
          'Số lượng (Quantity)': mold.quantity,
          'Thời gian đưa vào kệ (Scanned In)': mold.scanned_in_at 
            ? new Date(mold.scanned_in_at).toLocaleString() 
            : ''
        }));
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Du_Lieu_Ke_Khuon');
      XLSX.writeFile(wb, `Du_Lieu_Ke_Khuon_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      alert('Lỗi xuất Excel: ' + err.message);
    }
  };

  const handleRequiredAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setPendingAction(() => action);
      setShowAuthModal(true);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
      setShowAuthModal(false);
      setPassword('');
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2000);
    }
  };

  // Add or edit a shelf
  const handleSaveShelf = async () => {
    if (!newShelfName.trim()) {
      alert('Vui lòng nhập tên kệ!');
      return;
    }
    
    setIsAddingShelf(true);
    try {
      if (editingShelfId) {
        // Edit mode
        const { error } = await supabase
          .from('machines')
          .update({ name: newShelfName.trim() })
          .eq('id', editingShelfId);

        if (error) throw error;
      } else {
        // Add mode
        if (!newShelfId.trim()) {
          alert('Vui lòng nhập Mã số kệ!');
          setIsAddingShelf(false);
          return;
        }
        const idUpper = newShelfId.trim().toUpperCase();
        const shelfIdFormatted = idUpper.startsWith('SHELF-') ? idUpper : `SHELF-${idUpper}`;

        const { error } = await supabase
          .from('machines')
          .insert([{
            id: shelfIdFormatted,
            name: newShelfName.trim(),
            max_molds: 9999,
            status: 'optimal',
            operational_status: 'active'
          }]);

        if (error) throw error;
      }
      
      setIsAddShelfOpen(false);
      setNewShelfId('');
      setNewShelfName('');
      setEditingShelfId(null);
      await fetchData();
    } catch (error: any) {
      alert('Lỗi lưu kệ: ' + error.message);
    } finally {
      setIsAddingShelf(false);
    }
  };

  // Delete a shelf
  const handleDeleteShelf = async (shelf: Shelf) => {
    if (shelf.molds.length > 0) {
      alert('Không thể xóa kệ vì đang chứa khuôn! Hãy di chuyển hoặc xóa các khuôn ra khỏi kệ trước.');
      return;
    }

    if (!confirm(t('confirmDeleteShelf') || 'Bạn có chắc chắn muốn xóa kệ này không?')) return;

    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', shelf.id);
      
      if (error) throw error;
      if (selectedShelf?.id === shelf.id) {
        setIsDetailOpen(false);
        setSelectedShelf(null);
      }
      await fetchData();
    } catch (err: any) {
      alert('Lỗi xóa kệ: ' + err.message);
    }
  };

  // Quick adjust quantity of a mold in detailed view table (requires admin)
  const handleQuickUpdateQty = (mold: MoldInShelf, delta: number) => {
    handleRequiredAuth(async () => {
      if (!selectedShelf) return;
      const targetQty = mold.quantity + delta;
      
      if (targetQty <= 0) {
        if (confirm(`Bạn có chắc chắn muốn xóa khuôn ${mold.mold_id} (Size ${mold.mold_size}) khỏi kệ này không?`)) {
          try {
            if (mold.uuid) {
              const { error } = await supabase
                .from('running_molds')
                .delete()
                .eq('uuid', mold.uuid);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('running_molds')
                .delete()
                .eq('machine_id', selectedShelf.id)
                .eq('mold_id', mold.mold_id)
                .eq('mold_size', mold.mold_size);
              if (error) throw error;
            }
            await fetchData();
          } catch (err: any) {
            alert('Lỗi xóa khuôn khỏi kệ: ' + err.message);
          }
        }
        return;
      }

      // Chỉ kiểm tra giới hạn số lượng sở hữu tối đa khi chúng ta TĂNG số lượng (delta > 0)
      try {
        if (delta > 0) {
          const { data: matchMaster, error: mastErr } = await supabase
            .from('mold_master')
            .select('id, size, total_owned')
            .eq('id', mold.mold_id)
            .eq('size', mold.mold_size)
            .single();
          
          if (mastErr || !matchMaster) {
            alert(`Lỗi: Khuôn ${mold.mold_id} (Size ${mold.mold_size}) không tồn tại trong Dữ liệu Khuôn!`);
            return;
          }

          const { data: runningElsewhere, error: runErr } = await supabase
            .from('running_molds')
            .select('quantity')
            .eq('mold_id', mold.mold_id)
            .eq('mold_size', mold.mold_size)
            .neq('machine_id', selectedShelf.id);
          
          if (runErr) throw runErr;

          const elsewhereQty = (runningElsewhere || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
          const totalProposed = elsewhereQty + targetQty;
          const totalOwned = matchMaster.total_owned || 0;

          if (totalProposed > totalOwned) {
            alert(`Không thể tăng số lượng! Tổng số lượng khuôn trên kệ và máy (${totalProposed}) vượt quá số lượng sở hữu (${totalOwned}) của mã này.`);
            return;
          }
        }

        // Perform update in DB
        if (mold.uuid) {
          const { error } = await supabase
            .from('running_molds')
            .update({ quantity: targetQty })
            .eq('uuid', mold.uuid);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('running_molds')
            .update({ quantity: targetQty })
            .eq('machine_id', selectedShelf.id)
            .eq('mold_id', mold.mold_id)
            .eq('mold_size', mold.mold_size);
          if (error) throw error;
        }

        await fetchData();
      } catch (err: any) {
        alert('Lỗi cập nhật số lượng: ' + err.message);
      }
    });
  };

  // Quick delete a mold from detailed view table (requires admin)
  const handleQuickDeleteMold = (mold: MoldInShelf) => {
    handleRequiredAuth(async () => {
      if (!selectedShelf) return;
      if (!confirm(`Bạn có chắc chắn muốn xóa khuôn ${mold.mold_id} (Size ${mold.mold_size}) khỏi kệ này không?`)) return;

      try {
        if (mold.uuid) {
          const { error } = await supabase
            .from('running_molds')
            .delete()
            .eq('uuid', mold.uuid);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('running_molds')
            .delete()
            .eq('machine_id', selectedShelf.id)
            .eq('mold_id', mold.mold_id)
            .eq('mold_size', mold.mold_size);
          if (error) throw error;
        }

        await fetchData();
      } catch (err: any) {
        alert('Lỗi xóa khuôn khỏi kệ: ' + err.message);
      }
    });
  };

  // Transfer a mold (or partial quantity) from selectedShelf to another shelf
  const handleTransferMold = async () => {
    if (!selectedShelf || !transferMold || !transferTargetShelfId) return;
    if (transferTargetShelfId === selectedShelf.id) {
      alert('Kệ đích phải khác kệ nguồn!');
      return;
    }
    if (transferQty <= 0 || transferQty > transferMold.quantity) {
      alert(`Số lượng chuyển phải từ 1 đến ${transferMold.quantity}!`);
      return;
    }

    setIsTransferring(true);
    try {
      // 1. Check if target shelf already has this mold
      const { data: existingOnTarget, error: checkErr } = await supabase
        .from('running_molds')
        .select('uuid, quantity')
        .eq('machine_id', transferTargetShelfId)
        .eq('mold_id', transferMold.mold_id)
        .eq('mold_size', transferMold.mold_size)
        .maybeSingle();
      if (checkErr) throw checkErr;

      // 2. Update / remove source shelf
      const remainingQty = transferMold.quantity - transferQty;
      if (remainingQty <= 0) {
        // Remove mold from source
        if (transferMold.uuid) {
          const { error } = await supabase.from('running_molds').delete().eq('uuid', transferMold.uuid);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('running_molds').delete()
            .eq('machine_id', selectedShelf.id)
            .eq('mold_id', transferMold.mold_id)
            .eq('mold_size', transferMold.mold_size);
          if (error) throw error;
        }
      } else {
        // Reduce quantity on source
        if (transferMold.uuid) {
          const { error } = await supabase.from('running_molds').update({ quantity: remainingQty }).eq('uuid', transferMold.uuid);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('running_molds').update({ quantity: remainingQty })
            .eq('machine_id', selectedShelf.id)
            .eq('mold_id', transferMold.mold_id)
            .eq('mold_size', transferMold.mold_size);
          if (error) throw error;
        }
      }

      // 3. Upsert mold into target shelf
      if (existingOnTarget) {
        const { error } = await supabase.from('running_molds')
          .update({ quantity: existingOnTarget.quantity + transferQty })
          .eq('uuid', existingOnTarget.uuid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('running_molds').insert([{
          machine_id: transferTargetShelfId,
          mold_id: transferMold.mold_id,
          mold_size: transferMold.mold_size,
          quantity: transferQty,
          scanned_in_at: new Date().toISOString()
        }]);
        if (error) throw error;
      }

      setIsTransferOpen(false);
      setTransferMold(null);
      setTransferTargetShelfId('');
      setTransferQty(1);
      await fetchData();
    } catch (err: any) {
      alert('Lỗi chuyển khuôn: ' + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  // Manage manual stock edits
  const handleEditStockClick = () => {
    if (!selectedShelf) return;
    setEditingMolds(selectedShelf.molds.map(m => ({ ...m })));
    setIsEditingStock(true);
  };

  const handleUpdateStockQty = (index: number, delta: number) => {
    setEditingMolds(prev => {
      const updated = [...prev];
      updated[index].quantity = Math.max(0, updated[index].quantity + delta);
      return updated;
    });
  };

  const handleRemoveStockRow = (index: number) => {
    setEditingMolds(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddStockRow = () => {
    setEditingMolds(prev => [...prev, { mold_id: '', mold_size: '', quantity: 1 }]);
  };

  const handleStockRowChange = (index: number, field: keyof MoldInShelf, val: any) => {
    setEditingMolds(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Save stock inventory
  const handleSaveStock = async () => {
    if (!selectedShelf) return;
    setIsSavingStock(true);

    try {
      // 1. Basic validation (no empty mold IDs or sizes)
      for (const item of editingMolds) {
        if (!item.mold_id.trim()) {
          alert('Vui lòng nhập Mã khuôn cho tất cả các dòng!');
          setIsSavingStock(false);
          return;
        }
        if (!item.mold_size.trim()) {
          alert('Vui lòng nhập Size cho tất cả các dòng!');
          setIsSavingStock(false);
          return;
        }
      }

      // Group edits to check unique mold_id + mold_size combinations
      const groupedEdits = new Map<string, MoldInShelf>();
      for (const item of editingMolds) {
        const moldId = item.mold_id.trim().toUpperCase();
        const moldSize = item.mold_size.trim();
        const key = `${moldId}|${moldSize}`;
        
        if (groupedEdits.has(key)) {
          const existing = groupedEdits.get(key)!;
          existing.quantity += item.quantity;
        } else {
          groupedEdits.set(key, {
            ...item,
            mold_id: moldId,
            mold_size: moldSize
          });
        }
      }
      const finalEdits = Array.from(groupedEdits.values()).filter(e => e.quantity > 0);

      // 2. Query master database to verify existence and check total owned limit
      // Also query all currently running molds (excluding current shelf) to verify total cap
      const uniqueMoldIds = Array.from(new Set(finalEdits.map(e => e.mold_id)));
      
      if (uniqueMoldIds.length > 0) {
        // Fetch mold masters
        const { data: masters, error: mastErr } = await supabase
          .from('mold_master')
          .select('id, size, total_owned')
          .in('id', uniqueMoldIds);
        
        if (mastErr) throw mastErr;

        // Fetch running molds everywhere else (exclude current shelf)
        const { data: runningElsewhere, error: runErr } = await supabase
          .from('running_molds')
          .select('mold_id, mold_size, quantity')
          .neq('machine_id', selectedShelf.id);
        
        if (runErr) throw runErr;

        // Verify rules for each item
        for (const edit of finalEdits) {
          // Check existence
          const matchMaster = (masters || []).find(
            m => m.id === edit.mold_id && m.size === edit.mold_size
          );
          
          if (!matchMaster) {
            alert(t('errMoldNotInDatabase')
              .replace('{mold}', edit.mold_id)
              .replace('{size}', edit.mold_size)
              || `Mã khuôn ${edit.mold_id} (Size ${edit.mold_size}) chưa tồn tại trong Dữ liệu Khuôn! Vui lòng thêm nó ở trang Dữ liệu Khuôn trước.`);
            setIsSavingStock(false);
            return;
          }

          // Tìm số lượng cũ của khuôn này trên kệ hiện tại
          const originalItem = selectedShelf.molds.find(
            m => m.mold_id === edit.mold_id && m.mold_size === edit.mold_size
          );
          const currentShelfQty = originalItem?.quantity || 0;

          // Chỉ kiểm tra giới hạn sở hữu nếu số lượng mới lớn hơn số lượng hiện tại trên kệ (tức là ta đang muốn tăng thêm khuôn mới)
          if (edit.quantity > currentShelfQty) {
            const elsewhereQty = (runningElsewhere || [])
              .filter(r => r.mold_id === edit.mold_id && r.mold_size === edit.mold_size)
              .reduce((sum, item) => sum + (item.quantity || 0), 0);

            const totalProposed = elsewhereQty + edit.quantity;
            const totalOwned = matchMaster.total_owned || 0;

            if (totalProposed > totalOwned) {
              alert(t('errTotalShelfExceedsOwned')
                .replace('{total}', totalProposed.toString())
                .replace('{owned}', totalOwned.toString())
                || `Tổng số lượng khuôn ${edit.mold_id} (Size ${edit.mold_size}) trên kệ và máy (${totalProposed}) vượt quá số lượng hiện sở hữu (${totalOwned}) trong Dữ liệu khuôn! \n(Đang chạy ở máy/kệ khác: ${elsewhereQty}, Đề xuất nhập kệ này: ${edit.quantity})`);
              setIsSavingStock(false);
              return;
            }
          }
        }
      }

      // 3. Perform database operations:
      // Delete existing records for this shelf
      const { error: delErr } = await supabase
        .from('running_molds')
        .delete()
        .eq('machine_id', selectedShelf.id);
      
      if (delErr) throw delErr;

      // Insert new records
      if (finalEdits.length > 0) {
        const insertData = finalEdits.map(edit => ({
          machine_id: selectedShelf.id,
          mold_id: edit.mold_id,
          mold_size: edit.mold_size,
          quantity: edit.quantity,
          scanned_in_at: edit.scanned_in_at || new Date().toISOString()
        }));

        const { error: insErr } = await supabase
          .from('running_molds')
          .insert(insertData);
        if (insErr) throw insErr;
      }

      setIsEditingStock(false);
      await fetchData();
    } catch (err: any) {
      alert('Lỗi lưu kho: ' + err.message);
    } finally {
      setIsSavingStock(false);
    }
  };

  // Search filter
  const filteredShelves = shelves.filter(shelf => {
    const matchesSearch = shelf.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          shelf.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Area */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/20">
            <Archive className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('moldShelfData')}</h1>
            <p className="text-slate-400 text-sm">Quản lý định vị và số lượng khuôn lưu trữ trên các Kệ</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Main search shelf name */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Tìm tên kệ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm w-full sm:w-48"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Glowing Mold code finder */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder={t('searchShelfPlaceholder')}
              value={moldHighlightQuery}
              onChange={(e) => setMoldHighlightQuery(e.target.value)}
              className="bg-slate-900/50 border border-emerald-500/40 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm w-full sm:w-64"
            />
            <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {moldHighlightQuery && (
              <button
                onClick={() => setMoldHighlightQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          <button 
            onClick={() => handleRequiredAuth(() => {
              // Auto suggest next shelf ID
              setEditingShelfId(null);
              const nextNum = shelves.length + 1;
              setNewShelfId(String(nextNum).padStart(2, '0'));
              setNewShelfName(`Kệ ${String(nextNum).padStart(2, '0')}`);
              setIsAddShelfOpen(true);
            })}
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_14px_rgba(99,102,241,0.4)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addShelf')}</span>
          </button>

          <button 
            onClick={handleExportMovementHistoryExcel}
            className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_14px_rgba(139,92,246,0.4)] flex items-center gap-2"
            title="Tải file Excel báo cáo lịch sử di chuyển của tất cả khuôn"
          >
            <Download className="w-4 h-4" />
            <span>Lịch sử di chuyển Khuôn</span>
          </button>

          <button 
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_14px_rgba(16,185,129,0.4)] flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{t('exportExcel')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}
        
        {filteredShelves.length === 0 && !isLoading ? (
          <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
            <Archive className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Không tìm thấy kệ nào</p>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          >
            {filteredShelves.map((shelf) => {
              // Check if shelf contains the highlighted mold ID
              const hasHighlightedMold = moldHighlightQuery.trim() !== '' && 
                shelf.molds.some(m => m.mold_id.toLowerCase().includes(moldHighlightQuery.toLowerCase().trim()));
              
              const isSearching = moldHighlightQuery.trim() !== '';

              // CSS Classes for highlighting glow
              const cardClass = `relative bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border-2 transition-all cursor-pointer select-none text-left flex flex-col justify-between min-h-[170px] ${
                hasHighlightedMold 
                  ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/30 scale-102 hover:scale-105' 
                  : isSearching
                    ? 'border-slate-700/50 opacity-40 hover:opacity-70 scale-98'
                    : 'border-slate-700/50 hover:border-slate-500 hover:shadow-lg hover:scale-102'
              }`;

              const totalMolds = shelf.molds.reduce((sum, m) => sum + m.quantity, 0);

              return (
                <motion.div
                  layout
                  key={shelf.id}
                  onClick={() => {
                    setSelectedShelf(shelf);
                    setEditingMolds(shelf.molds.map(m => ({ ...m })));
                    setIsEditingStock(false);
                    setIsDetailOpen(true);
                  }}
                  className={cardClass}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-1.5 group/title">
                        <h3 className="font-black text-white text-base tracking-wider uppercase">{shelf.name}</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequiredAuth(() => {
                              setEditingShelfId(shelf.id);
                              setNewShelfId(shelf.id.replace('SHELF-', ''));
                              setNewShelfName(shelf.name);
                              setIsAddShelfOpen(true);
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 rounded-md transition-colors hover:bg-slate-700/50"
                          title="Sửa tên kệ"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono tracking-widest">{shelf.id.replace('SHELF-', '')}</span>
                    </div>

                    {/* Mold Summary */}
                    <div className="space-y-1.5 max-h-[80px] overflow-hidden">
                      {shelf.molds.length === 0 ? (
                        <p className="text-slate-500 text-xs italic">Kệ trống</p>
                      ) : (
                        shelf.molds.slice(0, 3).map((m, idx) => (
                          <div key={idx} className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-300 truncate mr-2">{m.mold_id}</span>
                            <span className="text-indigo-400 font-mono text-[10px] bg-slate-900/60 px-1.5 py-0.2 rounded border border-slate-700/50 flex-shrink-0 flex items-center gap-1.5">
                              {m.mold_size}
                              <span className="text-emerald-400 font-black">x{m.quantity}</span>
                            </span>
                          </div>
                        ))
                      )}
                      {shelf.molds.length > 3 && (
                        <p className="text-indigo-400 text-[10px] font-bold italic mt-1">+ {shelf.molds.length - 3} loại khác...</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-700/50">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Tổng khuôn</span>
                    <span className="text-sm font-black text-white bg-slate-900/80 border border-slate-700 px-2.5 py-0.5 rounded-lg font-mono">
                      {totalMolds}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Slide-over Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedShelf && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (isEditingStock && !confirm('Thay đổi chưa lưu sẽ bị mất. Bạn có muốn đóng không?')) return;
                setIsDetailOpen(false);
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-800 border-l border-slate-700 shadow-2xl z-50 flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-900/20">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-wider uppercase">{selectedShelf.name}</h2>
                    <button
                      onClick={() => handleRequiredAuth(() => {
                        setEditingShelfId(selectedShelf.id);
                        setNewShelfId(selectedShelf.id.replace('SHELF-', ''));
                        setNewShelfName(selectedShelf.name);
                        setIsAddShelfOpen(true);
                      })}
                      className="p-1 text-slate-400 hover:text-indigo-400 rounded-md transition-colors hover:bg-slate-700/50"
                      title="Sửa tên kệ"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedShelf.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRequiredAuth(() => handleDeleteShelf(selectedShelf))}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-xl transition-all"
                    title="Xóa kệ này"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (isEditingStock && !confirm('Thay đổi chưa lưu sẽ bị mất. Bạn có muốn đóng không?')) return;
                      setIsDetailOpen(false);
                    }}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 p-6 overflow-y-auto scrollbar-thin text-left space-y-6">
                
                {isEditingStock ? (
                  /* stock manual editor */
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Thiết lập Kho Kệ</h3>
                      <button
                        onClick={handleAddStockRow}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        + Thêm dòng khuôn
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {editingMolds.map((item, idx) => (
                        <div key={idx} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-3 relative">
                          <button
                            onClick={() => handleRemoveStockRow(idx)}
                            className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 transition-colors p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 relative">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Mã khuôn</label>
                              <input
                                type="text"
                                value={item.mold_id}
                                placeholder="VD: OV_0224"
                                onFocus={() => setFocusedRowIdx(idx)}
                                onBlur={() => setTimeout(() => setFocusedRowIdx(null), 250)}
                                onChange={(e) => {
                                  handleStockRowChange(idx, 'mold_id', e.target.value.toUpperCase());
                                  setFocusedRowIdx(idx);
                                }}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                              />

                              {/* Suggestions Dropdown */}
                              {focusedRowIdx === idx && item.mold_id.trim().length >= 1 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] max-h-40 overflow-y-auto z-[70] scrollbar-thin">
                                  {moldMasterList
                                    .filter(m => m.id.toLowerCase().includes(item.mold_id.toLowerCase().trim()))
                                    .slice(0, 10)
                                    .map((m, sIdx) => (
                                      <button
                                        key={sIdx}
                                        type="button"
                                        onMouseDown={() => {
                                          handleStockRowChange(idx, 'mold_id', m.id);
                                          handleStockRowChange(idx, 'mold_size', m.size);
                                          setFocusedRowIdx(null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-500/30 text-white font-bold text-xs border-b border-slate-800 last:border-0 flex justify-between items-center group transition-colors"
                                      >
                                        <span>{m.id}</span>
                                        <span className="text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-300 font-black uppercase ring-1 ring-indigo-500/30">{m.size}</span>
                                      </button>
                                    ))}
                                  {moldMasterList.filter(m => m.id.toLowerCase().includes(item.mold_id.toLowerCase().trim())).length === 0 && (
                                    <div className="px-3 py-3 text-slate-500 text-[10px] italic text-center">Không tìm thấy khuôn</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Size</label>
                              <input
                                type="text"
                                value={item.mold_size}
                                placeholder="VD: 7Y hoặc 4.5#-5.5#"
                                onChange={(e) => handleStockRowChange(idx, 'mold_size', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                            <span className="text-xs text-slate-400 font-semibold">Số lượng</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleUpdateStockQty(idx, -1)}
                                className="w-8 h-8 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                              >
                                -
                              </button>
                              <span className="text-sm font-black text-white w-8 text-center font-mono">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateStockQty(idx, 1)}
                                className="w-8 h-8 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {editingMolds.length === 0 && (
                        <div className="text-center py-6 text-slate-500 text-sm italic">Hãy nhấn Thêm dòng khuôn để nhập data kệ.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* standard detailed list view */
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Khuôn hiện có</h3>
                    
                    <div className="bg-slate-900/40 rounded-2xl border border-slate-700/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-700 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-3.5">Mã khuôn</th>
                            <th className="px-4 py-3.5">Size</th>
                            <th className="px-4 py-3.5 text-center">Số lượng</th>
                            <th className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1 text-emerald-400">
                                <LogIn className="w-3 h-3" />
                                <span>Scan In</span>
                              </div>
                            </th>
                            <th className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1 text-amber-400">
                                <LogOut className="w-3 h-3" />
                                <span>Scan Out</span>
                              </div>
                            </th>
                            <th className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1 text-sky-400">
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Chuyển</span>
                              </div>
                            </th>
                            <th className="px-4 py-3.5 text-right">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-sm">
                          {selectedShelf.molds.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-5 py-12 text-center text-slate-500 italic">
                                Kệ trống. Hãy scan thêm khuôn hoặc nhấn Chỉnh sửa để cập nhật.
                              </td>
                            </tr>
                          ) : (
                            selectedShelf.molds.map((m, idx) => {
                              const lastIn = getLastScanIn(selectedShelf.id, m.mold_id, m.mold_size, m.scanned_in_at);
                              const lastOut = getLastScanOut(selectedShelf.id, m.mold_id, m.mold_size);
                              return (
                              <tr key={idx} className="hover:bg-slate-800/30">
                                <td className="px-4 py-3.5 font-bold text-white">{m.mold_id}</td>
                                <td className="px-4 py-3.5">
                                  <span className="bg-slate-800 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded text-xs font-mono">
                                    {m.mold_size}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleQuickUpdateQty(m, -1)}
                                      className="w-6 h-6 bg-slate-850 border border-slate-750 hover:bg-slate-700 rounded-lg flex items-center justify-center text-white font-bold text-xs transition-colors"
                                      title="Giảm 1"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center font-mono font-bold text-white text-sm">
                                      {m.quantity}
                                    </span>
                                    <button
                                      onClick={() => handleQuickUpdateQty(m, 1)}
                                      className="w-6 h-6 bg-slate-850 border border-slate-750 hover:bg-slate-700 rounded-lg flex items-center justify-center text-white font-bold text-xs transition-colors"
                                      title="Tăng 1"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {lastIn ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                                        {new Date(lastIn).toLocaleDateString('vi-VN')}
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-mono">
                                        {new Date(lastIn).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-600 italic">N/A</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {lastOut ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[10px] text-amber-400 font-mono font-semibold">
                                        {new Date(lastOut).toLocaleDateString('vi-VN')}
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-mono">
                                        {new Date(lastOut).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-600 italic">N/A</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <button
                                    onClick={() => handleRequiredAuth(() => {
                                      setTransferMold(m);
                                      setTransferQty(m.quantity);
                                      setTransferTargetShelfId('');
                                      setIsTransferOpen(true);
                                    })}
                                    className="p-1.5 text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors"
                                    title="Chuyển khuôn sang kệ khác"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </button>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <button
                                    onClick={() => handleQuickDeleteMold(m)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                    title="Xóa khuôn khỏi kệ"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-700/50 bg-slate-900/30 flex gap-4">
                {isEditingStock ? (
                  <>
                    <button
                      onClick={() => setIsEditingStock(false)}
                      className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleSaveStock}
                      disabled={isSavingStock}
                      className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isSavingStock && <Loader2 className="w-4 h-4 animate-spin" />}
                      Lưu thay đổi
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsDetailOpen(false)}
                      className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={() => handleRequiredAuth(handleEditStockClick)}
                      className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 border border-indigo-400/30"
                    >
                      <Edit3 className="w-4 h-4" />
                      Chỉnh sửa Kho
                    </button>
                  </>
                )}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Transfer Mold Modal */}
      <AnimatePresence>
        {isTransferOpen && transferMold && selectedShelf && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsTransferOpen(false); }}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[55]"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="fixed inset-0 z-[56] flex items-center justify-center pointer-events-none p-4"
            >
              <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-8 max-w-sm w-full pointer-events-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-sky-500/20 rounded-2xl flex items-center justify-center border border-sky-500/30 flex-shrink-0">
                    <ArrowRightLeft className="w-6 h-6 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Chuyển Khuôn</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Từ <span className="text-white font-semibold">{selectedShelf.name}</span></p>
                  </div>
                </div>

                {/* Mold Info */}
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50 mb-5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Khuôn</span>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Tổng trên kệ này</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-black text-base">{transferMold.mold_id}</p>
                      <span className="inline-block mt-1 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">{transferMold.mold_size}</span>
                    </div>
                    <span className="text-2xl font-black text-white font-mono">{transferMold.quantity}</span>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="mb-5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Số lượng cần chuyển</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTransferQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl flex items-center justify-center font-bold text-white text-lg transition-colors"
                    >−</button>
                    <div className="flex-1 text-center">
                      <span className="text-3xl font-black text-white font-mono">{transferQty}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">/ {transferMold.quantity} cái</p>
                    </div>
                    <button
                      onClick={() => setTransferQty(q => Math.min(transferMold.quantity, q + 1))}
                      className="w-10 h-10 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl flex items-center justify-center font-bold text-white text-lg transition-colors"
                    >+</button>
                  </div>
                  {/* Quick select all */}
                  {transferQty < transferMold.quantity && (
                    <button
                      onClick={() => setTransferQty(transferMold.quantity)}
                      className="mt-2 w-full text-xs text-sky-400 hover:text-sky-300 font-semibold transition-colors"
                    >Chuyển tất cả ({transferMold.quantity} cái)</button>
                  )}
                </div>

                {/* Target Shelf Selector */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Chuyển đến kệ</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {shelves
                      .filter(s => s.id !== selectedShelf.id)
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => setTransferTargetShelfId(s.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            transferTargetShelfId === s.id
                              ? 'border-sky-500 bg-sky-500/15 ring-1 ring-sky-500/40'
                              : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-800/60'
                          }`}
                        >
                          <p className="text-white font-bold text-xs truncate">{s.name}</p>
                          <p className="text-slate-500 text-[10px] font-mono mt-0.5">{s.molds.reduce((sum, m) => sum + m.quantity, 0)} khuôn</p>
                        </button>
                      ))
                    }
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsTransferOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleTransferMold}
                    disabled={isTransferring || !transferTargetShelfId}
                    className="flex-1 py-3 rounded-xl font-bold bg-sky-500 text-white hover:bg-sky-400 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTransferring
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ArrowRightLeft className="w-4 h-4" />
                    }
                    {isTransferring ? 'Đang chuyển...' : 'Xác nhận chuyển'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Admin Password verification Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
            >
              <div className="bg-slate-800 border border-slate-750 rounded-3xl shadow-2xl p-8 max-w-sm w-full pointer-events-auto text-center">
                <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30 mx-auto mb-5">
                  <Lock className="w-8 h-8 text-rose-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{t('passwordRequired')}</h3>
                <p className="text-slate-400 text-xs mb-6">Bạn phải đăng nhập tài khoản Quản trị viên</p>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('enterPassword')}
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white focus:outline-none transition-all text-center tracking-[0.5em] font-mono ${
                      passwordError 
                        ? 'border-rose-500 focus:ring-rose-500 animate-shake ring-2 ring-rose-500/50' 
                        : 'border-slate-700 focus:ring-2 focus:ring-indigo-500'
                    }`}
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-rose-400 text-xs font-bold">{t('incorrectPassword')}</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 text-sm hover:text-white transition-colors"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all text-sm"
                    >
                      Xác nhận
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-over Modal for Adding / Editing a Shelf */}
      <AnimatePresence>
        {isAddShelfOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddShelfOpen(false);
                setNewShelfId('');
                setNewShelfName('');
                setEditingShelfId(null);
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-800 border-l border-slate-700 shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                <h2 className="text-xl font-bold text-white">{editingShelfId ? 'Chỉnh sửa Kệ' : 'Thêm Kệ Mới'}</h2>
                <button 
                  onClick={() => {
                    setIsAddShelfOpen(false);
                    setNewShelfId('');
                    setNewShelfName('');
                    setEditingShelfId(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mã số kệ (VD: 21, 22)</label>
                  <input 
                    type="text" 
                    value={newShelfId}
                    onChange={(e) => setNewShelfId(e.target.value)}
                    disabled={!!editingShelfId}
                    placeholder="VD: 21"
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono uppercase disabled:opacity-50"
                  />
                  {!editingShelfId && (
                    <p className="text-[10px] text-slate-500 font-medium">Mã hệ thống đầy đủ sẽ tự động thêm tiền tố: SHELF-XX</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('shelfName')}</label>
                  <input 
                    type="text" 
                    value={newShelfName}
                    onChange={(e) => setNewShelfName(e.target.value)}
                    placeholder="VD: Kệ 21"
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-700/50 bg-slate-900/30 flex gap-4">
                <button 
                  onClick={() => {
                    setIsAddShelfOpen(false);
                    setNewShelfId('');
                    setNewShelfName('');
                    setEditingShelfId(null);
                  }}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSaveShelf}
                  disabled={isAddingShelf}
                  className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)] hover:bg-indigo-400 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAddingShelf ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Lưu kệ
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mold Scan History Modal removed - replaced with direct Excel export */}

      {/* Auth Modal Shake Animation support */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}} />

    </div>
  );
}
