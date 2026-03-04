"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- UI 状态 ---
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell'); // 控制发布面板的 Tab

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
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (isLoggedIn && hasAgreed) {
      fetchPosts();
      const channel = supabase.channel('realtime_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, hasAgreed]);

  const handlePublish = async () => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('请填写完整信息');
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
      type: activeTab, // 使用当前选中的 Tab 类型
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

  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
    .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()));

  // ==========================================
  // 1. 登录页
  // ==========================================
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
              className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold active:scale-95 transition-transform shadow-md hover:bg-blue-600"
            >即刻进入</button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. 完整免责声明页
  // ==========================================
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
                    <p><strong>2. 风险自担：</strong>交易双方应自行承担交易风险。我们强烈建议您在交易前核实对方的真实性，并保留聊天记录和支付凭证。</p>
                    <p><strong>3. 严禁违规：</strong>严禁发布任何违法、违规、虚假或误导性信息。</p>
                    <p><strong>4. 责任豁免：</strong>平台不对因使用本服务而产生的任何直接、间接、偶然或特殊的损害承担责任。</p>
                    <p><strong>5. 内容声明：</strong>用户发布的任何内容仅代表其个人观点，不代表本站立场。</p>
                    <p><strong>6. 隐私保护：</strong>我们重视您的隐私，您的微信号仅在其他用户点击复制时才会显示并记录计数。</p>
                </div>

                <button 
                  onClick={() => setHasAgreed(true)} 
                  className="w-full bg-[#E60012] text-white py-4 rounded-xl font-bold active:scale-95 transition-all shadow-md hover:bg-red-600"
                >我已阅读并同意</button>
            </div>
        </div>
    );
  }

  // ==========================================
  // 3. 主界面 (全新 UI)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-16">
      {/* 顶部红条 */}
      <div className="h-2 bg-[#E60012] w-full"></div>

      {/* 导航栏 */}
      <header className="bg-white px-6 py-4 shadow-sm flex justify-between items-center max-w-5xl mx-auto">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">专注 <span className="text-[#E60012]">自提</span></h1>
          <span className="text-xs text-gray-400">泡泡玛特自提实时信息交流站</span>
        </div>
        <div className="flex items-center border border-gray-100 rounded-full pl-2 pr-4 py-1.5 shadow-sm bg-gray-50">
          <div className="w-8 h-8 bg-gray-200 rounded-full mr-3 flex items-center justify-center text-xs overflow-hidden">
            <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Felix" alt="avatar" className="w-full h-full object-cover"/>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold">{phone.slice(0,3)}****{phone.slice(-4)}</span>
            <button onClick={handleLogout} className="text-[10px] text-[#E60012] hover:underline text-left">退出登录</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        
        {/* 发布面板 (卡片) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 text-lg font-bold text-center">
            <button 
              onClick={() => setActiveTab('sell')} 
              className={`flex-1 py-5 transition-colors ${activeTab === 'sell' ? 'text-[#2D63FF] bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'}`}
            >
              出售自提码
              {activeTab === 'sell' && <div className="h-1 bg-[#2D63FF] w-16 mx-auto rounded-t-md mt-4 absolute" />}
            </button>
            <button 
              onClick={() => setActiveTab('buy')} 
              className={`flex-1 py-5 transition-colors ${activeTab === 'buy' ? 'text-[#2D63FF] bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'}`}
            >
              求购自提码
              {activeTab === 'buy' && <div className="h-1 bg-[#2D63FF] w-16 mx-auto rounded-t-md mt-4 absolute" />}
            </button>
          </div>

          {/* 表单区域 */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">标明价格 (元)</label>
                <input placeholder="例如：199" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} type="number"/>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">门店全名</label>
                <input placeholder="例如：上海静安大悦城店" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">商品全名</label>
                <input placeholder="例如：LABUBU 心动马卡龙" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">个人微信号</label>
                <input placeholder="微信号 (仅复制可见)" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">到期时间</label>
              <div className="flex gap-3">
                <button onClick={() => setFormData({...formData, expiryType: 'today'})} className={`px-5 py-2 rounded-full text-sm border ${formData.expiryType === 'today' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'}`}>今天 (23:59)</button>
                <button onClick={() => setFormData({...formData, expiryType: 'tomorrow'})} className={`px-5 py-2 rounded-full text-sm border ${formData.expiryType === 'tomorrow' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'}`}>明天 (23:59)</button>
              </div>
            </div>

            <button onClick={handlePublish} disabled={loading} className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-[0.98] transition-all shadow-md mt-4">
              {loading ? '发布中...' : '立即发布'}
            </button>
          </div>
        </section>

        {/* 实时大厅控制台 */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-[#E60012]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <h2 className="text-2xl font-bold">实时大厅</h2>
            </div>
            
            <div className="flex gap-3 text-sm w-full sm:w-auto">
              <select className="border border-gray-200 bg-white rounded-full px-4 py-2 outline-none" onChange={e=>setFilterType(e.target.value)}>
                <option value="all">全部类型</option>
                <option value="sell">仅看出售</option>
                <option value="buy">仅看求购</option>
              </select>
              <div className="relative flex-1 sm:w-48">
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                <input placeholder="搜索门店..." className="w-full pl-8 pr-4 py-2 rounded-full border border-gray-200 outline-none focus:border-[#2D63FF]" value={searchStore} onChange={e => setSearchStore(e.target.value)} />
              </div>
              <div className="relative flex-1 sm:w-48">
                <span className="absolute left-3 top-2.5 text-gray-400">🏷️</span>
                <input placeholder="搜索商品..." className="w-full pl-8 pr-4 py-2 rounded-full border border-gray-200 outline-none focus:border-[#2D63FF]" value={searchItem} onChange={e => setSearchItem(e.target.value)} />
              </div>
            </div>
          </div>

          {/* 帖子列表 */}
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 min-h-[200px] p-2">
            {displayPosts.length > 0 ? (
              <div className="space-y-2">
                {displayPosts.map(post => (
                  <div key={post.id} className="p-5 border border-gray-100 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 hover:shadow-md transition-shadow group bg-gray-50/50">
                    <div className="flex-1 flex gap-4 items-center w-full">
                      <div className={`px-3 py-1 rounded-md text-xs font-bold shrink-0 ${post.type === 'sell' ? 'bg-red-50 text-[#E60012] border border-red-100' : 'bg-blue-50 text-[#2D63FF] border border-blue-100'}`}>
                        {post.type === 'sell' ? '出售' : '求购'}
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <h4 className="font-bold text-gray-900 truncate">{post.shop}</h4>
                        <p className="text-xs text-gray-500 truncate">{post.item}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                      <span className="text-xl font-bold text-[#E60012]">￥{post.price}</span>
                      <button 
                        onClick={() => {navigator.clipboard.writeText(post.contact); alert('微信号已复制');}}
                        className="bg-[#2D63FF] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                      >复制微信</button>
                      
                      {post.user_phone === phone && (
                        <button onClick={() => handleDelete(post.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // 空状态
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <p className="text-sm font-medium">暂无匹配信息</p>
              </div>
            )}
          </div>
        </section>

        {/* 底部静态模块 (还原截图) */}
        <section className="space-y-6 pt-8">
          
          {/* 骗子公示栏 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <h3 className="font-bold text-lg">骗子信息公示栏</h3>
            </div>
            <div className="bg-[#FFF8F3] rounded-2xl overflow-hidden border border-orange-100/50">
              <div className="grid grid-cols-3 p-4 text-xs font-bold text-orange-800 border-b border-orange-100/50 text-center">
                <div>微信号</div>
                <div>微信名字</div>
                <div>受骗过程</div>
              </div>
              <div className="py-12 text-center text-sm text-orange-300 italic">
                暂无公示信息，天下无骗
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 my-8"></div>

          {/* 底部两列结构 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
            {/* 安全声明 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <h4 className="font-bold">安全与免责声明</h4>
              </div>
              <div className="text-xs text-gray-500 space-y-2 leading-relaxed">
                <p>1. 本平台仅作为玩家间信息交流使用，不参与任何交易过程。</p>
                <p>2. 请务必核实对方身份，建议在加好友后互传交易记录以防受骗。</p>
                <p>3. 任何因私下交易产生的纠纷与本站无关。</p>
                <p className="text-[#E60012] cursor-pointer hover:underline font-bold pt-1">查看完整声明</p>
              </div>
            </div>

            {/* 防骗举报 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-orange-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h4 className="font-bold">防骗举报</h4>
              </div>
              <p className="text-xs text-gray-500">发现骗子？请立即上传证据，核实后我们将全站公示该微信号。</p>
              <button className="w-full mt-2 py-3 bg-[#FFF8F3] text-orange-600 rounded-lg text-sm font-bold border border-orange-100 hover:bg-orange-50 transition-colors">
                上传骗子信息
              </button>
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
