import { useEffect, useState } from 'react';
import { useAuthStore, useUIStore } from '@/stores';
import { useModelsStore } from '@/stores/models';
import {
  deleteModelProfile,
  saveModelProfile,
  type ModelProfile,
  type ModelProfileDraft
} from '@/hooks/modelProfilesApi';
import './ModelManager.css';

const emptyDraft = (): ModelProfileDraft => ( { label:'', baseUrl:'', modelName:'', apiKey:'', isDefault:false } );

export function ModelManager() {
  const userId = useAuthStore((s) => s.user?.id);
  const showToast = useUIStore((s) => s.showToast);
  const { profiles, accountId, error, loading, load } = useModelsStore();
  const [ editingId, setEditingId ] = useState<string | undefined>();
  const [ draft, setDraft ] = useState(emptyDraft);
  const [ saving, setSaving ] = useState(false);
  const [ busyId, setBusyId ] = useState<string | null>(null);
  const currentAccount = userId == null ? null : String(userId);
  const visibleProfiles = accountId === currentAccount ? profiles : [];
  useEffect(() => {
    if (currentAccount) void load(currentAccount);
  }, [ currentAccount, load ]);
  const reset = () => {
    setEditingId(undefined);
    setDraft(emptyDraft());
  };
  const edit = (profile: ModelProfile) => {
    setEditingId(profile.id);
    setDraft({
      label:profile.label,
      baseUrl:profile.baseUrl,
      modelName:profile.modelName,
      apiKey:'',
      isDefault:profile.isDefault
    });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentAccount || saving) return;
    setSaving(true);
    try {
      await saveModelProfile({
        ... draft,
        label:draft.label.trim(),
        baseUrl:draft.baseUrl.trim(),
        modelName:draft.modelName.trim(),
        apiKey:draft.apiKey?.trim() || undefined
      }, editingId);
      reset();
      await load(currentAccount);
      showToast('success', '模型配置已保存');
    } catch (err) {
      setDraft((value) => ( { ... value, apiKey:'' } ));
      showToast('error', ( err as Error ).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (profile: ModelProfile) => {
    if (!currentAccount || !window.confirm(`删除模型配置「${ profile.label }」？`)) return;
    setBusyId(profile.id);
    try {
      await deleteModelProfile(profile.id);
      if (editingId === profile.id) reset();
      await load(currentAccount);
      showToast('success', '模型配置已删除');
    } catch (err) {
      showToast('error', ( err as Error ).message);
    } finally {
      setBusyId(null);
    }
  };
  const makeDefault = async (profile: ModelProfile) => {
    if (!currentAccount) return;
    setBusyId(profile.id);
    try {
      await saveModelProfile({
        label:profile.label,
        baseUrl:profile.baseUrl,
        modelName:profile.modelName,
        isDefault:true
      }, profile.id);
      await load(currentAccount);
      showToast('success', '默认模型已更新');
    } catch (err) {
      showToast('error', ( err as Error ).message);
    } finally {
      setBusyId(null);
    }
  };
  return <div className="model-manager">
    <section className="profile-section model-manager__list">
      <h2 className="profile-card__section-title">我的模型</h2>
      <p className="profile-section__desc">保存常用模型，在聊天时直接选择。支持 OpenAI 兼容接口。</p>
      { error && <div className="auth-card__error">{ error }
        <button
          type="button"
          onClick={ () => currentAccount && void load(currentAccount) }
        >重新加载
        </button>
                 </div> }
      { loading && visibleProfiles.length === 0 ?
        <p className="model-manager__empty">加载中...</p> : visibleProfiles.length === 0 && !error ?
          <p className="model-manager__empty">还没有自定义模型，添加一个作为创作起点。</p> : null }
      { visibleProfiles.map((profile) => <article
        className="model-entry"
        key={ profile.id }
                                         >
        <div className="model-entry__heading"><h3>{ profile.label }</h3>{ profile.isDefault && <span>默认</span> }</div>
        <p>{ profile.modelName }</p><p className="model-entry__url">{ profile.baseUrl }</p>
        <p className="model-entry__key">API Key：{ profile.keyMask }</p>
        <div className="model-entry__actions">
          <button
            type="button"
            disabled={ saving || busyId !== null }
            onClick={ () => edit(profile) }
          >编辑
          </button>
          { !profile.isDefault && <button
            type="button"
            disabled={ saving || busyId !== null }
            onClick={ () => void makeDefault(profile) }
                                  >设为默认
                                  </button> }
          <button
            type="button"
            disabled={ saving || busyId !== null }
            onClick={ () => void remove(profile) }
          >删除
          </button>
        </div>
                                         </article>) }
    </section>
    <section className="profile-section">
      <h2 className="profile-card__section-title">{ editingId ? '编辑模型' : '添加模型' }</h2>
      <p className="profile-section__desc">密钥由服务端加密保存；保存后仅显示掩码。</p>
      <form
        className="auth-form"
        onSubmit={ save }
      >
        <fieldset
          disabled={ saving }
          className="model-manager__fields"
        >
          <label className="auth-form__field"><span className="auth-form__label">显示名称</span><input
            className="auth-form__input"
            required
            maxLength={ 64 }
            placeholder="例如：我的 DeepSeek"
            value={ draft.label }
            onChange={ (e) => setDraft({ ... draft, label:e.target.value }) }
                                                                                            />
          </label>
          <label className="auth-form__field"><span className="auth-form__label">服务地址（Base URL）</span><input
            className="auth-form__input"
            type="url"
            required
            maxLength={ 512 }
            placeholder="https://api.deepseek.com/v1"
            value={ draft.baseUrl }
            onChange={ (e) => setDraft({ ... draft, baseUrl:e.target.value }) }
                                                                                                      />
          </label>
          <label className="auth-form__field"><span className="auth-form__label">模型名称</span><input
            className="auth-form__input"
            required
            maxLength={ 128 }
            placeholder="服务商提供的模型 ID"
            value={ draft.modelName }
            onChange={ (e) => setDraft({ ... draft, modelName:e.target.value }) }
                                                                                            />
          </label>
          <label className="auth-form__field">
            <span className="auth-form__label">API Key</span>
            <input
              className="auth-form__input"
              type="password"
              autoComplete="new-password"
              required={ !editingId }
              maxLength={ 2048 }
              placeholder={ editingId ? '留空保留原密钥；填写则替换' : '填写服务商提供的密钥' }
              value={ draft.apiKey }
              onChange={ (e) => setDraft({ ... draft, apiKey:e.target.value }) }
            />
          </label>
          <label className="model-manager__default">
            <input
              type="checkbox"
              checked={ draft.isDefault }
              onChange={ (e) => setDraft({
                ... draft,
                isDefault:e.target.checked
              }) }
            />
            设为默认模型
          </label>
        </fieldset>
        <div className="model-entry__actions">
          <button
            className="auth-form__btn"
            type="submit"
            disabled={ saving }
          >{ saving ? '保存中...' : '保存模型' }
          </button>
          { editingId && <button
            type="button"
            disabled={ saving }
            onClick={ reset }
                         >取消编辑
                         </button> }
        </div>
      </form>
    </section>
         </div>;
}
