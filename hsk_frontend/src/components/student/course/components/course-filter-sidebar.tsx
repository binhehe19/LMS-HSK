/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import {
    AUDIENCES,
    AudienceId,
    CategoryId,
    COURSE_CATEGORIES,
    PRICE_MAX,
    STUDY_FORMS,
    StudyFormId,
} from '../data/catalog-courses';

/** Icon export thẳng từ Figma node 3362:9968 */
const IC = '/assets/hocba/courses';

export interface CourseFilterState {
    /** rỗng = "Tất cả" */
    categories: CategoryId[];
    audience: AudienceId | 'all';
    studyForms: StudyFormId[];
    maxPrice: number;
}

export const DEFAULT_FILTERS: CourseFilterState = {
    categories: [],
    audience: 'all',
    studyForms: [],
    maxPrice: PRICE_MAX,
};

interface GroupProps {
    icon: string;
    iconWidth: number;
    iconHeight: number;
    title: string;
    /** Nhóm đầu tiên nằm ngay dưới đường kẻ của phần tiêu đề nên không cần viền trên */
    first?: boolean;
    className?: string;
    children: React.ReactNode;
}

const FilterGroup: React.FC<GroupProps> = ({ icon, iconWidth, iconHeight, title, first, className, children }) => {
    const [open, setOpen] = useState(true);

    return (
        <div className={`hb-course__filter-group${first ? ' hb-course__filter-group--first' : ''}${className ? ` ${className}` : ''}`}>
            <button
                type="button"
                className="hb-course__filter-toggle"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="hb-course__filter-toggle-label">
                    <img src={`${IC}/${icon}`} alt="" width={iconWidth} height={iconHeight} />
                    {title}
                </span>
                <img
                    className="hb-course__filter-chevron"
                    src={`${IC}/ic-chevron.svg`}
                    alt=""
                    width={12}
                    height={7.4}
                />
            </button>
            {open && <div className="hb-course__filter-body">{children}</div>}
        </div>
    );
};

interface Props {
    value: CourseFilterState;
    onChange: (next: CourseFilterState) => void;
    onClose?: () => void;
    /** số khoá theo từng hình thức học, hiển thị ở badge bên phải */
    studyFormCounts: Record<StudyFormId, number>;
}

const formatPrice = (value: number) =>
    value === 0 ? '0đ' : `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}Tr.đ`;

const Checkbox: React.FC<{ checked: boolean; onToggle: () => void; label: string; trailing?: React.ReactNode }> = ({
    checked,
    onToggle,
    label,
    trailing,
}) => (
    <label className="hb-course__check">
        <span className="hb-course__check-main">
            <input type="checkbox" checked={checked} onChange={onToggle} />
            <span className="hb-course__check-box" aria-hidden="true">
                {checked && <img src={`${IC}/ic-checkmark.svg`} alt="" width={16} height={16} />}
            </span>
            {label}
        </span>
        {trailing}
    </label>
);

const CourseFilterSidebar: React.FC<Props> = ({ value, onChange, studyFormCounts, onClose }) => {
    const toggleCategory = (id: CategoryId) => {
        const next = value.categories.includes(id)
            ? value.categories.filter((c) => c !== id)
            : [...value.categories, id];
        onChange({ ...value, categories: next });
    };

    const toggleStudyForm = (id: StudyFormId) => {
        const next = value.studyForms.includes(id)
            ? value.studyForms.filter((f) => f !== id)
            : [...value.studyForms, id];
        onChange({ ...value, studyForms: next });
    };

    const pricePercent = Math.round((value.maxPrice / PRICE_MAX) * 100);

    return (
        <aside className="hb-course__sidebar">
            <div className="hb-course__sidebar-head">
                <h2 className="hb-course__sidebar-title">
                    <img src={`${IC}/ic-filter.svg`} alt="" width={13.368} height={13.333} />
                    Bộ lọc
                </h2>
                <button type="button" className="hb-course__sidebar-close" aria-label="Đóng bộ lọc" onClick={onClose}>×</button>
                <button type="button" className="hb-course__sidebar-clear" onClick={() => onChange(DEFAULT_FILTERS)}>
                    Xóa tất cả
                </button>
            </div>

            <FilterGroup first title="Danh mục" icon="ic-category.svg" iconWidth={18} iconHeight={18}>
                <Checkbox
                    checked={value.categories.length === 0}
                    onToggle={() => onChange({ ...value, categories: [] })}
                    label="Tất cả"
                />
                {COURSE_CATEGORIES.map((cat) => (
                    <Checkbox
                        key={cat.id}
                        checked={value.categories.includes(cat.id)}
                        onToggle={() => toggleCategory(cat.id)}
                        label={cat.filterLabel}
                    />
                ))}
            </FilterGroup>

            <FilterGroup title="Đối tượng" icon="ic-audience.svg" iconWidth={20} iconHeight={10}>
                <div className="hb-course__chips">
                    <button
                        type="button"
                        className={`hb-course__chip${value.audience === 'all' ? ' hb-course__chip--active' : ''}`}
                        onClick={() => onChange({ ...value, audience: 'all' })}
                    >
                        Tất cả
                    </button>
                    {AUDIENCES.map((a) => (
                        <button
                            type="button"
                            key={a.id}
                            className={`hb-course__chip${value.audience === a.id ? ' hb-course__chip--active' : ''}`}
                            onClick={() => onChange({ ...value, audience: a.id })}
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            </FilterGroup>

            <FilterGroup className="hb-course__filter-group--studyform" title="Hình thức học" icon="ic-studyform.svg" iconWidth={18.333} iconHeight={15}>
                {STUDY_FORMS.map((f) => (
                    <Checkbox
                        key={f.id}
                        checked={value.studyForms.includes(f.id)}
                        onToggle={() => toggleStudyForm(f.id)}
                        label={f.label}
                        trailing={<span className="hb-course__check-count">{studyFormCounts[f.id] ?? 0}</span>}
                    />
                ))}
            </FilterGroup>

            <FilterGroup className="hb-course__filter-group--price" title="Khoảng giá" icon="ic-price.svg" iconWidth={18.333} iconHeight={13.333}>
                <div className="hb-course__price">
                    <div className="hb-course__price-rail">
                        <div className="hb-course__price-fill" style={{ width: `${pricePercent}%` }} />
                        <input
                            className="hb-course__price-slider"
                            type="range"
                            min={0}
                            max={PRICE_MAX}
                            step={100_000}
                            value={value.maxPrice}
                            onChange={(e) => onChange({ ...value, maxPrice: Number(e.target.value) })}
                            aria-label="Giá tối đa"
                        />
                    </div>
                    <div className="hb-course__price-legend">
                        <span>0đ</span>
                        <span>{formatPrice(value.maxPrice)}</span>
                    </div>
                </div>
            </FilterGroup>
        </aside>
    );
};

export default CourseFilterSidebar;
