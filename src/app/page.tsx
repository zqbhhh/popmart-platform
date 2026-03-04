"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- 视觉辅助：莫兰迪色系配置 ---
const MORANDI = {
  stone: '#9A8C98', // 烟灰紫
  leaf: '#B9B7BD',  // 灰绿
  sand: '#F2E9E4',  // 浅沙色
  ocean: '#4A4E69', // 深黛蓝
  accent: '#C6A49A', // 藕粉
};

// --- 工具函数：时间处理 ---
const formatExpiryDisplay = (dateString: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return `${d.getMonth() + 1}月${d.getDate()}日 23:00`;
};

const formatTimeAgo = (dateString: string) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚发布';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  return `${past.getMonth() + 1}月${past.getDate()}日`;
};

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // --- UI 状态 ---
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [showPersonalMenu, setShowPersonalMenu] = useState(false); // 个人中心开关
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // 鼠标跟随

  const [searchStore, setSearchStore] = useState(''); 
  const [searchItem, setSearchItem] = useState('');   
  const [filterType, setFilterType] = useState('all'); 

  const [formData, setFormData] = useState({ 
    price: '', shop: '', item: '', contact: '', 
    expiryType: 'today', customDate: '' 
  });

  // --- 🔒 初始化设备指纹与鼠标跟随 ---
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('device_fingerprint')) {
      localStorage.setItem('device_fingerprint', Math.random().toString(36).substring(2, 15));
    }
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        const now = new Date();
        // 自动过滤已过期信息（逻辑删除）
        const validPosts = data.filter(post => !post.expires_at || new Date(post.expires_at) > now);
        setPosts(validPosts);
      }
    } catch (err) { console.error(err); } finally { setIsFetching(false); }
  };

  useEffect(() => {
    if (isLoggedIn && hasAgreed) {
      setIsFetching(true);
      fetchPosts();
      const channel = supabase.channel('realtime_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, hasAgreed]);

  // --- 关键修改：锁定 23:00 过期 ---
  const handlePublish = async () => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('请填写完整信息');
    setLoading(true);
    
    const getExpiryDate = () => {
        const d = new Date();
        if (formData.expiryType === 'today') {
            d.setHours(23, 0, 0, 0);
        } else if (formData.expiryType === 'tomorrow') {
            d.setDate(d.getDate() + 1);
            d.setHours(23, 0, 0, 0);
        } else if (formData.customDate) {
            const [y, m, day] = formData.customDate.split('-');
            return new Date(parseInt(y), parseInt(m)-1, parseInt(day), 23, 0, 0);
        }
        return d;
    };

    const { error } = await supabase.from('posts').insert([{ 
      ...formData, 
      type: activeTab,
      user_phone: phone,
      device_token: localStorage.getItem('device_fingerprint'),
      expires_at: getExpiryDate().toISOString(),
      price: parseFloat(formData.price) 
    }]);

    if (!error) {
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
      fetchPosts();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条信息吗？')) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (!error) fetchPosts();
    }
  };

  // 综合过滤
  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.includes(searchStore) && p.item.includes(searchItem));

  const myPosts = posts.filter(p => p.user_phone === phone);

  // --- 样式辅助变量 ---
  const springConfig = "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]";
  const glassStyle = "bg-white/40 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(154,140,152,0.15)]";

  // 1. 登录页 & 声明页 (略，保持原有逻辑但应用莫兰迪色系)
  if (!isLoggedIn || !hasAgreed) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-[#F2E9E4] p-6">
            <div className={`max-w-md w-full p-8 rounded-[40px] ${glassStyle} space-y-6 text-center`}>
                <h1 className="text-3xl font-bold text-[#4A4E69] tracking-widest">专注 · 自提</h1>
                {!isLoggedIn ? (
                    <div className="space-y-4">
                        <input className="w-full p-4 rounded-2xl bg-white/50 border-none outline-none text-center" placeholder="输入手机号" value={phone} onChange={e=>setPhone(e.target.value)} />
                        <button onClick={()=>phone.length===11?setIsLoggedIn(true):null} className={`w-full py-4 bg-[#9A8C98] text-white rounded-2xl font-bold ${springConfig} hover:scale-[1.02] active:scale-95`}>开启探索</button>
                    </div>
                ) : (
                    <div className="space-y-4 text-left text-sm text-[#4A4E69]/80 leading-relaxed">
                        <p className="font-bold text-center text-lg mb-4">用户须知</p>
                        <p>1. 本平台仅作为自提信息撮合空间。</p>
                        <p>2. 信息设定的到期时间统一为当晚 23:00。</p>
                        <button onClick={()=>setHasAgreed(true)} className="w-full py-4 bg-[#4A4E69] text-white rounded-2xl font-bold mt-4">我已阅读并同意</button>
                    </div>
                )}
            </div>
        </div>
     )
  }

  return (
    <div className="min-h-screen bg-[#F2E9E4] text-[#4A4E69] selection:bg-[#C6A49A]/30">
      {/* 鼠标跟随装饰 */}
      <div 
        className="pointer-events-none fixed w-64 h-64 rounded-full bg-[#C6A49A]/10 blur-[100px] z-0 transition-transform duration-500"
        style={{ transform: `translate(${mousePos.x - 128}px, ${mousePos.y - 128}px)` }}
      />

      {/* 顶部喷泉建筑弧形装饰 */}
      <div className="h-40 bg-[#9A8C98] rounded-b-[100px] absolute top-0 w-full z-0 opacity-20" />

      {/* 导航栏 */}
      <header className="relative z-10 max-w-5xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="group cursor-default">
          <h1 className="text-2xl font-black tracking-tighter text-[#4A4E69]">POPMART <span className="text-[#C6A49A]">MARKET</span></h1>
          <div className="h-0.5 bg-[#C6A49A] w-0 group-hover:w-full transition-all duration-500" />
        </div>

        {/* 右上角个人中心 */}
        <div className="relative">
          <button 
            onClick={() => setShowPersonalMenu(!showPersonalMenu)}
            className={`flex items-center gap-3 px-4 py-2 rounded-full ${glassStyle} ${springConfig} hover:translate-y-[-2px]`}
          >
            <div className="w-8 h-8 rounded-full bg-[#9A8C98] flex items-center justify-center text-white text-xs font-bold">MY</div>
            <span className="text-sm font-medium">{phone.slice(-4)}</span>
          </button>

          {showPersonalMenu && (
            <div className={`absolute right-0 mt-3 w-72 p-4 rounded-[24px] ${glassStyle} z-50 animate-in fade-in slide-in-from-top-2`}>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#4A4E69]/10">
                <span className="font-bold">我的发布</span>
                <button onClick={handleLogout} className="text-xs text-red-400">退出登录</button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {myPosts.length > 0 ? myPosts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-white/30 text-xs">
                    <span className="truncate w-32">{p.item}</span>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:scale-110 transition-transform">删除</button>
                  </div>
                )) : <p className="text-center py-4 text-gray-400 text-xs">暂无发布记录</p>}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pb-20 space-y-12">
        {/* 发布区域 - 喷泉座造型 */}
        <section className={`rounded-[40px] p-1 ${glassStyle}`}>
          <div className="flex bg-white/20 rounded-t-[38px] overflow-hidden">
            <button onClick={() => setActiveTab('sell')} className={`flex-1 py-6 font-bold text-sm ${springConfig} ${activeTab === 'sell' ? 'bg-white/60 text-[#4A4E69]' : 'text-gray-400 hover:text-[#9A8C98]'}`}>出售码</button>
            <button onClick={() => setActiveTab('buy')} className={`flex-1 py-6 font-bold text-sm ${springConfig} ${activeTab === 'buy' ? 'bg-white/60 text-[#4A4E69]' : 'text-gray-400 hover:text-[#9A8C98]'}`}>求购码</button>
          </div>

          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#9A8C98] uppercase ml-2">Shop 门店名称</label>
                <input className="w-full p-4 rounded-2xl bg-white/40 border-none focus:ring-2 ring-[#C6A49A]/20 outline-none text-sm" placeholder="例如：上海美罗城店" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#9A8C98] uppercase ml-2">Price 预期价格</label>
                <input className="w-full p-4 rounded-2xl bg-white/40 border-none focus:ring-2 ring-[#C6A49A]/20 outline-none text-sm font-bold text-[#C6A49A]" type="number" placeholder="0.00" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
             </div>
             <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-[#9A8C98] uppercase ml-2">Item 详细描述</label>
                <input className="w-full p-4 rounded-2xl bg-white/40 border-none focus:ring-2 ring-[#C6A49A]/20 outline-none text-sm" placeholder="描述你的宝贝..." value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
             </div>
             
             {/* 过期时间选择器 */}
             <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-bold text-[#9A8C98] uppercase ml-2">Expiry 自动下架时间 (统一23:00失效)</label>
                <div className="flex gap-2 flex-wrap">
                    {['today', 'tomorrow', 'custom'].map(type => (
                        <button key={type} onClick={() => setFormData({...formData, expiryType: type})} className={`px-5 py-2 rounded-full text-xs font-bold ${springConfig} ${formData.expiryType === type ? 'bg-[#4A4E69] text-white shadow-lg shadow-[#4A4E69]/20' : 'bg-white/40 hover:bg-white/60'}`}>
                            {type === 'today' ? '今天' : type === 'tomorrow' ? '明天' : '自选日期'}
                        </button>
                    ))}
                    {formData.expiryType === 'custom' && (
                        <input type="date" className="bg-white/40 border-none rounded-full px-4 text-xs outline-none" onChange={e=>setFormData({...formData, customDate: e.target.value})} />
                    )}
                </div>
             </div>

             <button onClick={handlePublish} disabled={loading} className={`md:col-span-2 py-5 rounded-[24px] bg-[#4A4E69] text-white font-black text-lg shadow-xl shadow-[#4A4E69]/20 hover:scale-[1.01] active:scale-[0.98] ${springConfig}`}>
                {loading ? 'PUBLISHING...' : '立即发布'}
             </button>
          </div>
        </section>

        {/* 实时大厅 */}
        <section className="space-y-6">
          <div className="flex items-end justify-between px-4">
            <div>
                <h2 className="text-4xl font-black text-[#4A4E69]">实时 <span className="text-[#C6A49A]">大厅</span></h2>
                <p className="text-xs text-[#9A8C98] mt-1 font-medium tracking-widest">REAL-TIME FEEDS</p>
            </div>
            <div className="flex gap-2">
                <input placeholder="搜索门店" className="p-2 bg-white/40 rounded-xl text-xs outline-none w-32 border border-white/40" value={searchStore} onChange={e=>setSearchStore(e.target.value)} />
                <select className="p-2 bg-white/40 rounded-xl text-xs outline-none border border-white/40" onChange={e=>setFilterType(e.target.value)}>
                    <option value="all">全类型</option>
                    <option value="sell">仅出售</option>
                    <option value="buy">仅求购</option>
                </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayPosts.map(post => {
                const isMine = post.user_phone === phone;
                return (
                    <div key={post.id} className={`group p-6 rounded-[32px] ${glassStyle} ${springConfig} hover:translate-y-[-4px] flex flex-col justify-between`}>
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${post.type === 'sell' ? 'bg-red-100 text-red-400' : 'bg-blue-100 text-blue-400'}`}>
                                    {post.type === 'sell' ? 'FOR SALE' : 'BUYING'}
                                </span>
                                <span className="text-[10px] text-[#9A8C98] font-medium">{formatTimeAgo(post.created_at)}</span>
                            </div>
                            <h3 className="text-lg font-bold mb-1 truncate">{post.shop}</h3>
                            <p className="text-sm text-[#4A4E69]/60 mb-6 line-clamp-2 min-h-[40px] leading-relaxed">{post.item}</p>
                        </div>

                        <div className="pt-4 border-t border-[#4A4E69]/5 flex justify-between items-center">
                            <div>
                                <div className="text-2xl font-black text-[#C6A49A]">￥{post.price}</div>
                                <div className="text-[10px] text-[#9A8C98] mt-1">
                                    过期时间：<span className="font-bold">{formatExpiryDisplay(post.expires_at)}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => { navigator.clipboard.writeText(post.contact); alert('已复制微信号'); }}
                                className={`px-6 py-3 rounded-2xl bg-[#9A8C98] text-white text-xs font-bold hover:bg-[#4A4E69] ${springConfig}`}
                            >
                                复制微信
                            </button>
                        </div>
                    </div>
                )
            })}
          </div>
        </section>
      </main>
    </div>
  );

  function handleLogout() {
    setIsLoggedIn(false);
    setHasAgreed(false);
    setPhone('');
    setShowPersonalMenu(false);
  }
}
