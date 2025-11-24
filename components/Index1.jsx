import React, { useState, useRef, useEffect } from 'react';
import {
    Thermometer,
    Shield,
    Activity,
    Pill,
    Droplets,
    Heart,
    Zap,
    CircleEllipsis,
    AlertTriangle,
    Bone,
    Scale,
    Flame,
    Target,
    TrendingUp,
    Eye,
    Brain,
    Wind,
} from 'lucide-react';

import CalculatorGames from './CalculatorGames';
import LatestJobs from './LatestJobs';
import WhyChoose from './WhyChoose';

const HealthRiskComponent = () => {
    const [selectedCondition, setSelectedCondition] = useState('joints');
    const [activePage, setActivePage] = useState(0);
    const scrollRef = useRef(null);

    const healthConditions = [
        {
            id: 'fever',
            name: 'Fever',
            icon: <Thermometer className="w-8 h-8" />,
            description: 'Can signal infection or serious illness.'
        },
        {
            id: 'std',
            name: 'STD',
            icon: <Shield className="w-8 h-8" />,
            description: 'May cause infertility or long-term health damage.'
        },
        {
            id: 'liver',
            name: 'Liver',
            icon: <Activity className="w-8 h-8" />,
            description: 'Poor function can lead to liver failure.'
        },
        {
            id: 'vitamins',
            name: 'Vitamins',
            icon: <Pill className="w-8 h-8" />,
            description: 'Deficiency weakens immunity and energy.'
        },
        {
            id: 'diabetes',
            name: 'Diabetes',
            icon: <Droplets className="w-8 h-8" />,
            description: 'Can damage heart, kidneys, eyes, and nerves.'
        },
        {
            id: 'heart',
            name: 'Heart',
            icon: <Heart className="w-8 h-8" />,
            description: 'Increases risk of heart attack and stroke.'
        },
        {
            id: 'thyroid',
            name: 'Thyroid',
            icon: <Zap className="w-8 h-8" />,
            description: 'Can cause fatigue, weight changes, and mood issues.'
        },
        {
            id: 'kidney',
            name: 'Kidney',
            icon: <CircleEllipsis className="w-8 h-8" />,
            description: 'Failure can cause toxin buildup and serious illness.'
        },
        {
            id: 'allergy',
            name: 'Allergy',
            icon: <AlertTriangle className="w-8 h-8" />,
            description: 'May trigger asthma or severe reactions.'
        },
        {
            id: 'bone',
            name: 'Bone',
            icon: <Bone className="w-8 h-8" />,
            description: 'Weak bones raise fracture and disability risk.'
        },
        {
            id: 'acidity',
            name: 'Acidity',
            icon: <Flame className="w-8 h-8" />,
            description: 'Can damage the esophagus and cause ulcers.'
        },
        {
            id: 'cancer',
            name: 'Cancer',
            icon: <Target className="w-8 h-8" />,
            description: 'Uncontrolled growth can be life-threatening.'
        },
        {
            id: 'anemia',
            name: 'Anemia',
            icon: <Droplets className="w-8 h-8" />,
            description: 'Causes fatigue, weakness, and poor focus.'
        },
        {
            id: 'obesity',
            name: 'Obesity',
            icon: <Scale className="w-8 h-8" />,
            description: 'Increases diabetes, heart disease, and cancer risk.'
        },
        {
            id: 'hypertension',
            name: 'Hypertension',
            icon: <TrendingUp className="w-8 h-8" />,
            description: 'Raises risk of stroke, heart, and kidney disease.'
        },
        {
            id: 'vision',
            name: 'Vision',
            icon: <Eye className="w-8 h-8" />,
            description: 'Poor vision can cause accidents and blindness.'
        },
        {
            id: 'mental-health',
            name: 'Mental Health',
            icon: <Brain className="w-8 h-8" />,
            description: 'Can lead to stress, anxiety, or depression.'
        },
        {
            id: 'respiratory',
            name: 'Respiratory',
            icon: <Wind className="w-8 h-8" />,
            description: 'Can cause breathlessness and lung damage.'
        },
    ];

    const cardsPerPage = 3;
    const totalPages = Math.ceil(healthConditions.length / cardsPerPage);

    useEffect(() => {
        const handleScroll = () => {
            if (scrollRef.current) {
                const scrollPosition = scrollRef.current.scrollLeft;
                const cardWidth = scrollRef.current.firstChild
                    ? scrollRef.current.firstChild.offsetWidth + 16
                    : 0;
                const page = Math.round(scrollPosition / (cardWidth * cardsPerPage));
                setActivePage(page);
            }
        };

        const el = scrollRef.current;
        if (el) {
            el.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (el) el.removeEventListener('scroll', handleScroll);
        };
    }, [cardsPerPage]);

    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        let autoScrollInterval = setInterval(() => {
            const cardWidth = (scrollContainer.firstChild?.offsetWidth || 0) + 24;
            const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
            const currentScroll = scrollContainer.scrollLeft;

            if (currentScroll >= maxScroll - 10) {
                scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                scrollContainer.scrollTo({
                    left: currentScroll + cardWidth,
                    behavior: 'smooth'
                });
            }
        }, 3000);

        const handleMouseEnter = () => clearInterval(autoScrollInterval);
        const handleMouseLeave = () => {
            autoScrollInterval = setInterval(() => {
                const cardWidth = (scrollContainer.firstChild?.offsetWidth || 0) + 24;
                const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
                const currentScroll = scrollContainer.scrollLeft;

                if (currentScroll >= maxScroll - 10) {
                    scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    scrollContainer.scrollTo({
                        left: currentScroll + cardWidth,
                        behavior: 'smooth'
                    });
                }
            }, 3000);
        };

        scrollContainer.addEventListener('mouseenter', handleMouseEnter);
        scrollContainer.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            clearInterval(autoScrollInterval);
            scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
            scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    return (
        <div className="w-full bg-white py-8 px-4">
            <div className="max-w-6xl mx-auto">
            <div className="w-full">
                    <LatestJobs />
                </div>
                {/* Calculator and games */}
                <CalculatorGames />
            
                {/* ==================== WHY CHOOSE US ==================== */}
               <WhyChoose />
            </div>

            <style jsx>{`
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default HealthRiskComponent;