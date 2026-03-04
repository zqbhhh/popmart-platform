"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- 工具函数：时间戳格式化 ---
const formatTimeAgo = (dateString: string) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return '刚刚发布';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${past.getMonth() + 1}-${past.getDate()} ${past.getHours()}:${past.getMinutes().toString().padStart(2, '0')}`;
};

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true); // 骨架屏加载状态

  // --- UI 状态 ---
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [showOnlyMine, setShowOnlyMine] = useState(false); // 只看我的发布

  // --- 搜索状态 ---
  const [searchStore, setSearchStore] = useState(''); 
  const [searchItem, setSearchItem] = useState('');   
  const [filterType, setFilterType] = useState('all'); 

  const [formData, setFormData] = useState({ 
    price: '', shop: '', item: '', contact: '', 
    expiryType: 'today', customDate: '' 
  });

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        const now = new Date();
        const validPosts = data.filter(post => !post.expires_at || new Date(post.expires_at) > now);
        setPosts(validPosts);
      }
    } catch (err) { 
      console.error(err); 
    } finally {
      setIsFetching(false); // 数据拉取完毕，关闭骨架屏
    }
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

  const handlePublish = async () => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('请填写完整信息');
    if (formData.expiryType === 'custom' && !formData.customDate) return alert('请选择自定义截止日期');

    setLoading(true);
    
    const getExpiryDate = () => {
        const d = new Date();
        if (formData.expiryType === 'today') d.setHours(23, 59, 59);
        else if (formData.expiryType === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(23, 59, 59); }
        else if (formData.customDate) return new Date(formData.customDate + "T23:59:59");
        return d;
    };

    const { error } = await supabase.from('posts').insert([{ 
      ...formData, 
      type: activeTab,
      user_phone: phone,
      expires_at: getExpiryDate().toISOString(),
      price: parseFloat(formData.price) 
    }]);

    if (error) alert('发布失败');
    else {
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
      alert('发布成功！');
      fetchPosts();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要撤回这条发布信息吗？')) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) alert('删除失败');
      else fetchPosts();
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setHasAgreed(false);
    setPhone('');
  };

  // 综合过滤逻辑
  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
    .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()))
    .filter(p => showOnlyMine ? p.user_phone === phone : true);

  // 1. 登录页
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7]">
        <div className="w-full max-w-sm bg-white p-10 rounded-3xl shadow-sm text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">专注 <span className="text-[#E60012]">自提</span></h1>
            <p className="text-sm text-gray-500">泡泡玛特自提实时信息交流站</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" placeholder="请输入手机号登录" 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-center outline-none focus:border-[#2D63FF] transition-all"
              value={phone} onChange={e => setPhone(e.target.value)}
            />
            <button 
              onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('请输入11位手机号')} 
              className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold active:scale-95 transition-transform shadow-md"
            >即刻进入</button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 完整免责声明页
  if (isLoggedIn && !hasAgreed) {
    return (
        <div className="fixed inset-0 bg-white flex items-center justify-center z-50 p-6 overflow-y-auto">
            <div className="max-w-md w-full space-y-6 my-auto">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">用户须知与声明</h2>
                  <p className="text-sm text-gray-500">为了您的安全，请仔细阅读</p>
                </div>
                
                <div className="text-[14px] text-gray-600 leading-relaxed space-y-4 bg-gray-50 p-6 rounded-2xl">
                    <p><strong>1. 信息中转站：</strong>本平台仅为玩家提供自提码转让与求购的信息发布空间，不提供任何担保、中介或支付服务。</p>
                    <p><strong>2. 风险自担：</strong>交易双方应自行承担交易风险。我们建议交易前核实对方真实性。</p>
                    <p><strong>3. 严禁违规：</strong>严禁发布任何违法、违规、虚假信息。</p>
                    <p><strong>4. 责任豁免：</strong>平台不对交易产生的任何损害承担责任。</p>
                    <p><strong>5. 内容声明：</strong>用户发布内容仅代表其个人观点，不代表本站立场。</p>
                    <p><strong>6. 隐私保护：</strong>您的微信号仅在其他用户点击复制时才会显示。</p>
                </div>

                <button 
                  onClick={() => setHasAgreed(true)} 
                  className="w-full bg-[#E60012] text-white py-4 rounded-xl font-bold active:scale-95 transition-all shadow-md"
                >我已阅读并同意</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-16">
      <div className="h-2 bg-[#E60012] w-full"></div>

      <header className="bg-white px-6 py-4 shadow-sm flex justify-between items-center max-w-5xl mx-auto">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">专注 <span className="text-[#E60012]">自提</span></h1>
          <span className="text-xs text-gray-400">实时信息交流站</span>
        </div>
        <div className="flex items-center border border-gray-100 rounded-full pl-2 pr-4 py-1.5 shadow-sm bg-gray-50">
          <div className="w-8 h-8 bg-[#2D63FF] rounded-full mr-3 flex items-center justify-center text-white text-[10px] font-bold">PRO</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold">{phone.slice(0,3)}****{phone.slice(-4)}</span>
            <button onClick={handleLogout} className="text-[10px] text-[#E60012] text-left">退出登录</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* 发布面板 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100 text-lg font-bold text-center">
            <button onClick={() => setActiveTab('sell')} className={`flex-1 py-5 transition-colors ${activeTab === 'sell' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>出售自提码</button>
            <button onClick={() => setActiveTab('buy')} className={`flex-1 py-5 transition-colors ${activeTab === 'buy' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>求购自提码</button>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">标明价格 (元)</label>
                <input placeholder="例如：199" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm font-bold text-[#E60012]" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} type="number"/>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">门店全名</label>
                <input placeholder="例如：北京三里屯店" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">商品全名</label>
                <input placeholder="例如：Molly 散货" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">个人微信号</label>
                <input placeholder="仅复制可见" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
              </div>
              
              {/* 5. 日期选择组件 */}
              <div className="space-y-2 col-span-1 md:col-span-2 pt-2">
                <label className="text-xs text-gray-500">自提有效期限 (过期自动下架)</label>
                <div className="flex flex-wrap gap-3 items-center">
                  <button onClick={() => setFormData({...formData, expiryType: 'today'})} className={`px-4 py-2 rounded-lg text-sm transition-all border ${formData.expiryType === 'today' ? 'bg-[#2D63FF] text-white border-[#2D63FF]' : 'bg-white text-gray-600 border-gray-200'}`}>今天到期</button>
                  <button onClick={() => setFormData({...formData, expiryType: 'tomorrow'})} className={`px-4 py-2 rounded-lg text-sm transition-all border ${formData.expiryType === 'tomorrow' ? 'bg-[#2D63FF] text-white border-[#2D63FF]' : 'bg-white text-gray-600 border-gray-200'}`}>明天到期</button>
                  <button onClick={() => setFormData({...formData, expiryType: 'custom'})} className={`px-4 py-2 rounded-lg text-sm transition-all border ${formData.expiryType === 'custom' ? 'bg-[#2D63FF] text-white border-[#2D63FF]' : 'bg-white text-gray-600 border-gray-200'}`}>自选日期</button>
                  
                  {formData.expiryType === 'custom' && (
                    <input 
                      type="date" 
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2D63FF] bg-gray-50" 
                      value={formData.customDate} 
                      onChange={e => setFormData({...formData, customDate: e.target.value})}
                      min={new Date().toISOString().split('T')[0]} // 禁止选过去
                    />
                  )}
                </div>
              </div>
            </div>
            
            <button onClick={handlePublish} disabled={loading} className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition-all shadow-md">
              {loading ? '发布中...' : '立即发布'}
            </button>
          </div>
        </section>

        {/* 实时大厅 */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="w-2 h-6 bg-[#E60012] rounded-full"></span>
                  实时大厅
              </h2>
              {/* 2. 我的发布管理开关 */}
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50">
                <input type="checkbox" className="w-4 h-4 accent-[#2D63FF]" checked={showOnlyMine} onChange={e => setShowOnlyMine(e.target.checked)} />
                <span className="text-sm font-bold text-gray-700">只看我的发布</span>
              </label>
            </div>

            {/* 7. 分离的搜索区 & 4. 快捷标签 */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                  <select className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D63FF]" onChange={e=>setFilterType(e.target.value)}>
                      <option value="all">全部类型</option>
                      <option value="sell">仅看出售</option>
                      <option value="buy">仅看求购</option>
                  </select>
                  <input placeholder="🔍 搜门店 (如：三里屯)" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm focus:border-[#2D63FF]" value={searchStore} onChange={e => setSearchStore(e.target.value)} />
                  <input placeholder="🔍 搜商品 (如：散货)" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm focus:border-[#2D63FF]" value={searchItem} onChange={e => setSearchItem(e.target.value)} />
              </div>
              
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-400 font-medium ml-1">热门搜索：</span>
                {['静安大悦城', '王府井', 'LABUBU', '心动马卡龙', 'MEGA'].map(tag => (
                  <button 
                    key={tag} 
                    onClick={() => {
                       if(tag.includes('店') || tag.includes('城') || tag.includes('王府井')) setSearchStore(tag);
                       else setSearchItem(tag);
                    }}
                    className="text-xs bg-blue-50 text-[#2D63FF] px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
                <button onClick={()=>{setSearchStore(''); setSearchItem('');}} className="text-xs text-gray-400 underline ml-2">清空</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 min-h-[300px] p-2 shadow-sm">
            {/* 6. 骨架屏加载状态 */}
            {isFetching ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-5 border border-gray-50 rounded-xl flex items-center gap-4 bg-gray-50/50 animate-pulse">
                    <div className="w-10 h-6 bg-gray-200 rounded shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div className="w-16 h-6 bg-gray-200 rounded"></div>
                    <div className="w-24 h-9 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : displayPosts.length > 0 ? (
              <div className="space-y-2">
                {displayPosts.map(post => (
                  <div key={post.id} className="relative p-5 border border-gray-50 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30 hover:bg-white transition-all group">
                    
                    {/* 3. 时间戳显示 */}
                    <div className="absolute top-3 right-4 text-[11px] text-gray-400 font-medium">
                      {formatTimeAgo(post.created_at)}
                    </div>

                    <div className="flex-1 flex gap-4 items-center w-full mt-2 sm:mt-0">
                      <div className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${post.type === 'sell' ? 'bg-red-50 text-[#E60012]' : 'bg-blue-50 text-[#2D63FF]'}`}>
                        {post.type === 'sell' ? 'SELL' : 'BUY'}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <h4 className="font-bold text-gray-900 truncate pr-16">{post.shop}</h4>
                        <p className="text-xs text-gray-500 truncate">{post.item}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between shrink-0">
                      {/* 4. 视觉高亮：突出价格 */}
                      <span className="text-xl font-black text-[#E60012] drop-shadow-sm">￥{post.price}</span>
                      
                      <button onClick={() => {
                        navigator.clipboard.writeText(post.contact); 
                        alert('✅ 微信号已复制！\n请打开微信搜索添加好友。');
                      }} className="bg-[#2D63FF] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">
                        复制微信
                      </button>
                      
                      {post.user_phone === phone && (
                        <button onClick={() => handleDelete(post.id)} className="text-gray-300 hover:text-red-500 p-1" title="删除我的发布">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-300 space-y-2">
                <div className="text-4xl">🔍</div>
                <p className="text-sm">暂无匹配信息，换个词试试</p>
              </div>
            )}
          </div>
        </section>

      </main>
      
      <footer className="max-w-4xl mx-auto px-4 text-center text-[10px] text-gray-400">
          <p>© 2026 专注自提交流站 · 仅供玩家信息交流 · 交易风险自担</p>
      </footer>
    </div>
  );
}
