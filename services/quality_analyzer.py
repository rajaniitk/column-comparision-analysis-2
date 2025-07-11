import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
import logging
from datetime import datetime
import re

class QualityAnalyzer:
    """
    Comprehensive data quality analyzer that evaluates datasets across multiple dimensions:
    - Completeness: Missing data analysis
    - Consistency: Data format and pattern consistency
    - Validity: Data type and value validity
    - Uniqueness: Duplicate detection and analysis
    - Accuracy: Outlier detection and data integrity
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def analyze_dataset_quality(self, df: pd.DataFrame, dataset_name: str = "Dataset") -> Dict[str, Any]:
        """
        Perform comprehensive quality analysis on a dataset
        
        Args:
            df: DataFrame to analyze
            dataset_name: Name of the dataset for reporting
            
        Returns:
            Dict containing quality metrics and analysis results
        """
        try:
            if df is None or df.empty:
                return self._empty_dataset_quality(dataset_name)
            
            quality_metrics = {
                'dataset': dataset_name,
                'completeness': self._calculate_completeness(df),
                'consistency': self._calculate_consistency(df),
                'validity': self._calculate_validity(df),
                'uniqueness': self._calculate_uniqueness(df),
                'accuracy': self._calculate_accuracy(df),
                'overall_score': 0.0,
                'issues': [],
                'recommendations': [],
                'detailed_analysis': self._detailed_column_analysis(df)
            }
            
            # Calculate overall quality score
            quality_metrics['overall_score'] = self._calculate_overall_score(quality_metrics)
            
            # Generate issues and recommendations
            quality_metrics['issues'] = self._identify_issues(quality_metrics, df)
            quality_metrics['recommendations'] = self._generate_recommendations(quality_metrics, df)
            
            return quality_metrics
            
        except Exception as e:
            self.logger.error(f"Error analyzing dataset quality: {str(e)}")
            return self._error_quality_result(dataset_name, str(e))
    
    def _calculate_completeness(self, df: pd.DataFrame) -> float:
        """Calculate data completeness percentage"""
        try:
            total_cells = df.shape[0] * df.shape[1]
            if total_cells == 0:
                return 100.0
                
            missing_cells = df.isnull().sum().sum()
            completeness = ((total_cells - missing_cells) / total_cells) * 100
            
            return round(completeness, 2)
        except Exception as e:
            self.logger.warning(f"Error calculating completeness: {str(e)}")
            return 0.0
    
    def _calculate_consistency(self, df: pd.DataFrame) -> float:
        """Calculate data consistency score based on format patterns and types"""
        try:
            consistency_scores = []
            
            for column in df.columns:
                col_data = df[column].dropna()
                if len(col_data) == 0:
                    continue
                
                # For object/string columns, check format consistency
                if col_data.dtype == 'object':
                    consistency_scores.append(self._calculate_string_consistency(col_data))
                # For numeric columns, check for reasonable ranges and patterns
                elif pd.api.types.is_numeric_dtype(col_data):
                    consistency_scores.append(self._calculate_numeric_consistency(col_data))
                # For datetime columns
                elif pd.api.types.is_datetime64_any_dtype(col_data):
                    consistency_scores.append(self._calculate_datetime_consistency(col_data))
                else:
                    consistency_scores.append(85.0)  # Default score for other types
            
            if not consistency_scores:
                return 100.0
                
            return round(np.mean(consistency_scores), 2)
        except Exception as e:
            self.logger.warning(f"Error calculating consistency: {str(e)}")
            return 80.0
    
    def _calculate_validity(self, df: pd.DataFrame) -> float:
        """Calculate data validity score based on data types and business rules"""
        try:
            validity_scores = []
            
            for column in df.columns:
                col_data = df[column].dropna()
                if len(col_data) == 0:
                    validity_scores.append(100.0)
                    continue
                
                # Check for valid data based on expected patterns
                if col_data.dtype == 'object':
                    validity_scores.append(self._calculate_string_validity(col_data, column))
                elif pd.api.types.is_numeric_dtype(col_data):
                    validity_scores.append(self._calculate_numeric_validity(col_data, column))
                elif pd.api.types.is_datetime64_any_dtype(col_data):
                    validity_scores.append(self._calculate_datetime_validity(col_data))
                else:
                    validity_scores.append(90.0)
            
            if not validity_scores:
                return 100.0
                
            return round(np.mean(validity_scores), 2)
        except Exception as e:
            self.logger.warning(f"Error calculating validity: {str(e)}")
            return 85.0
    
    def _calculate_uniqueness(self, df: pd.DataFrame) -> float:
        """Calculate uniqueness score based on duplicate analysis"""
        try:
            total_rows = len(df)
            if total_rows == 0:
                return 100.0
            
            # Calculate duplicate percentages
            duplicate_rows = df.duplicated().sum()
            row_uniqueness = ((total_rows - duplicate_rows) / total_rows) * 100
            
            # Calculate average column uniqueness
            column_uniqueness_scores = []
            for column in df.columns:
                col_data = df[column].dropna()
                if len(col_data) > 0:
                    unique_values = col_data.nunique()
                    col_uniqueness = (unique_values / len(col_data)) * 100
                    column_uniqueness_scores.append(col_uniqueness)
            
            if column_uniqueness_scores:
                avg_col_uniqueness = np.mean(column_uniqueness_scores)
            else:
                avg_col_uniqueness = 100.0
            
            # Weighted combination of row and column uniqueness
            overall_uniqueness = (row_uniqueness * 0.6) + (avg_col_uniqueness * 0.4)
            
            return round(overall_uniqueness, 2)
        except Exception as e:
            self.logger.warning(f"Error calculating uniqueness: {str(e)}")
            return 75.0
    
    def _calculate_accuracy(self, df: pd.DataFrame) -> float:
        """Calculate accuracy score based on outlier detection and data integrity"""
        try:
            accuracy_scores = []
            
            for column in df.columns:
                col_data = df[column].dropna()
                if len(col_data) == 0:
                    continue
                
                if pd.api.types.is_numeric_dtype(col_data):
                    # Use IQR method for outlier detection
                    Q1 = col_data.quantile(0.25)
                    Q3 = col_data.quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    outliers = col_data[(col_data < lower_bound) | (col_data > upper_bound)]
                    accuracy = ((len(col_data) - len(outliers)) / len(col_data)) * 100
                    accuracy_scores.append(accuracy)
                else:
                    # For non-numeric columns, assume high accuracy unless patterns suggest otherwise
                    accuracy_scores.append(90.0)
            
            if not accuracy_scores:
                return 100.0
                
            return round(np.mean(accuracy_scores), 2)
        except Exception as e:
            self.logger.warning(f"Error calculating accuracy: {str(e)}")
            return 88.0
    
    def _calculate_string_consistency(self, col_data: pd.Series) -> float:
        """Calculate consistency for string/object columns"""
        try:
            # Check for consistent formatting patterns
            str_data = col_data.astype(str)
            
            # Length consistency
            lengths = str_data.str.len()
            length_std = lengths.std()
            length_mean = lengths.mean()
            length_cv = (length_std / length_mean) if length_mean > 0 else 0
            
            # Case consistency
            case_consistency = (
                (str_data.str.islower().sum() + str_data.str.isupper().sum()) / len(str_data)
            ) * 100
            
            # Pattern consistency (e.g., email, phone numbers)
            pattern_score = self._check_pattern_consistency(str_data)
            
            # Combine scores
            consistency = (
                (100 - min(100, length_cv * 50)) * 0.4 +
                case_consistency * 0.3 +
                pattern_score * 0.3
            )
            
            return max(70.0, consistency)  # Minimum threshold
        except Exception:
            return 85.0
    
    def _calculate_numeric_consistency(self, col_data: pd.Series) -> float:
        """Calculate consistency for numeric columns"""
        try:
            # Check for reasonable scale and precision
            if len(col_data) == 0:
                return 100.0
            
            # Scale consistency (orders of magnitude)
            log_values = np.log10(np.abs(col_data[col_data != 0]) + 1)
            scale_std = log_values.std() if len(log_values) > 0 else 0
            scale_score = max(0, 100 - (scale_std * 20))
            
            # Precision consistency (decimal places)
            decimal_places = []
            for val in col_data:
                if pd.notna(val):
                    decimal_str = str(float(val))
                    if '.' in decimal_str:
                        decimal_places.append(len(decimal_str.split('.')[1]))
                    else:
                        decimal_places.append(0)
            
            if decimal_places:
                precision_std = np.std(decimal_places)
                precision_score = max(0, 100 - (precision_std * 10))
            else:
                precision_score = 100.0
            
            return (scale_score + precision_score) / 2
        except Exception:
            return 90.0
    
    def _calculate_datetime_consistency(self, col_data: pd.Series) -> float:
        """Calculate consistency for datetime columns"""
        try:
            # Check for consistent datetime formats and ranges
            date_formats = []
            for val in col_data.astype(str):
                if '-' in val and ':' in val:
                    date_formats.append('datetime')
                elif '-' in val:
                    date_formats.append('date')
                else:
                    date_formats.append('other')
            
            if date_formats:
                most_common = max(set(date_formats), key=date_formats.count)
                consistency = (date_formats.count(most_common) / len(date_formats)) * 100
                return consistency
            return 100.0
        except Exception:
            return 85.0
    
    def _calculate_string_validity(self, col_data: pd.Series, column_name: str) -> float:
        """Calculate validity for string columns based on common patterns"""
        try:
            str_data = col_data.astype(str)
            valid_count = 0
            
            # Check for common invalid patterns
            for value in str_data:
                is_valid = True
                
                # Check for placeholder values
                if value.lower() in ['null', 'none', 'n/a', 'na', '', 'undefined', 'unknown']:
                    is_valid = False
                
                # Check for obvious encoding issues
                if '?' in value or '\x' in value:
                    is_valid = False
                
                # Column-specific validation
                if 'email' in column_name.lower():
                    if '@' not in value or '.' not in value:
                        is_valid = False
                elif 'phone' in column_name.lower():
                    digits = re.sub(r'[^\d]', '', value)
                    if len(digits) < 7 or len(digits) > 15:
                        is_valid = False
                
                if is_valid:
                    valid_count += 1
            
            return (valid_count / len(str_data)) * 100 if len(str_data) > 0 else 100.0
        except Exception:
            return 90.0
    
    def _calculate_numeric_validity(self, col_data: pd.Series, column_name: str) -> float:
        """Calculate validity for numeric columns"""
        try:
            valid_count = 0
            
            for value in col_data:
                is_valid = True
                
                # Check for infinite values
                if np.isinf(value):
                    is_valid = False
                
                # Column-specific validation
                if 'age' in column_name.lower():
                    if value < 0 or value > 150:
                        is_valid = False
                elif 'percent' in column_name.lower():
                    if value < 0 or value > 100:
                        is_valid = False
                elif 'price' in column_name.lower() or 'cost' in column_name.lower():
                    if value < 0:
                        is_valid = False
                
                if is_valid:
                    valid_count += 1
            
            return (valid_count / len(col_data)) * 100 if len(col_data) > 0 else 100.0
        except Exception:
            return 95.0
    
    def _calculate_datetime_validity(self, col_data: pd.Series) -> float:
        """Calculate validity for datetime columns"""
        try:
            valid_count = 0
            
            for value in col_data:
                try:
                    # Check if it's a valid datetime
                    if pd.notna(value) and pd.to_datetime(value, errors='coerce') is not pd.NaT:
                        valid_count += 1
                except:
                    pass
            
            return (valid_count / len(col_data)) * 100 if len(col_data) > 0 else 100.0
        except Exception:
            return 90.0
    
    def _check_pattern_consistency(self, str_data: pd.Series) -> float:
        """Check for consistent patterns in string data"""
        try:
            # Common patterns
            patterns = {
                'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
                'phone': r'^[\+]?[1-9][\d\s\-\(\)\.]{7,15}$',
                'url': r'^https?://[^\s/$.?#].[^\s]*$',
                'postal_code': r'^[A-Z0-9\s\-]{3,10}$'
            }
            
            pattern_scores = []
            for pattern_name, pattern in patterns.items():
                matches = str_data.str.match(pattern, case=False).sum()
                if matches > len(str_data) * 0.7:  # If 70% match a pattern
                    pattern_scores.append(95.0)
                    break
            
            if not pattern_scores:
                # Check for general consistency
                first_char_types = str_data.str[0].apply(lambda x: 'digit' if x.isdigit() else 'alpha' if x.isalpha() else 'other')
                most_common_type = first_char_types.mode().iloc[0] if len(first_char_types.mode()) > 0 else 'other'
                consistency = (first_char_types == most_common_type).sum() / len(first_char_types) * 100
                pattern_scores.append(consistency)
            
            return pattern_scores[0] if pattern_scores else 80.0
        except Exception:
            return 80.0
    
    def _calculate_overall_score(self, quality_metrics: Dict[str, Any]) -> float:
        """Calculate weighted overall quality score"""
        try:
            weights = {
                'completeness': 0.25,
                'consistency': 0.20,
                'validity': 0.25,
                'uniqueness': 0.15,
                'accuracy': 0.15
            }
            
            overall_score = 0.0
            for metric, weight in weights.items():
                if metric in quality_metrics and isinstance(quality_metrics[metric], (int, float)):
                    overall_score += quality_metrics[metric] * weight
            
            return round(overall_score, 2)
        except Exception:
            return 80.0
    
    def _detailed_column_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform detailed analysis for each column"""
        try:
            column_analysis = {}
            
            for column in df.columns:
                col_data = df[column].dropna()
                
                analysis = {
                    'data_type': str(df[column].dtype),
                    'total_count': len(df[column]),
                    'non_null_count': len(col_data),
                    'null_count': df[column].isnull().sum(),
                    'null_percentage': (df[column].isnull().sum() / len(df[column])) * 100,
                    'unique_count': df[column].nunique(),
                    'unique_percentage': (df[column].nunique() / len(df[column])) * 100 if len(df[column]) > 0 else 0
                }
                
                if pd.api.types.is_numeric_dtype(col_data) and len(col_data) > 0:
                    analysis.update({
                        'mean': float(col_data.mean()),
                        'median': float(col_data.median()),
                        'std': float(col_data.std()),
                        'min': float(col_data.min()),
                        'max': float(col_data.max())
                    })
                elif col_data.dtype == 'object' and len(col_data) > 0:
                    analysis.update({
                        'most_frequent': str(col_data.mode().iloc[0]) if len(col_data.mode()) > 0 else 'N/A',
                        'avg_length': float(col_data.astype(str).str.len().mean())
                    })
                
                column_analysis[column] = analysis
            
            return column_analysis
        except Exception as e:
            self.logger.warning(f"Error in detailed column analysis: {str(e)}")
            return {}
    
    def _identify_issues(self, quality_metrics: Dict[str, Any], df: pd.DataFrame) -> List[str]:
        """Identify specific data quality issues"""
        issues = []
        
        try:
            # Completeness issues
            if quality_metrics.get('completeness', 100) < 90:
                missing_percentage = 100 - quality_metrics['completeness']
                issues.append(f"High missing data rate: {missing_percentage:.1f}% of data is missing")
            
            # Consistency issues
            if quality_metrics.get('consistency', 100) < 85:
                issues.append("Data format inconsistencies detected across columns")
            
            # Validity issues
            if quality_metrics.get('validity', 100) < 90:
                issues.append("Invalid data values detected in one or more columns")
            
            # Uniqueness issues
            if quality_metrics.get('uniqueness', 100) < 70:
                duplicate_count = df.duplicated().sum()
                if duplicate_count > 0:
                    issues.append(f"High duplication rate: {duplicate_count} duplicate rows found")
            
            # Accuracy issues
            if quality_metrics.get('accuracy', 100) < 85:
                issues.append("Potential outliers or data accuracy issues detected")
            
            # Specific column issues
            for column in df.columns:
                null_percentage = (df[column].isnull().sum() / len(df[column])) * 100
                if null_percentage > 50:
                    issues.append(f"Column '{column}' has {null_percentage:.1f}% missing values")
        
        except Exception as e:
            self.logger.warning(f"Error identifying issues: {str(e)}")
            issues.append("Unable to complete full quality assessment")
        
        return issues
    
    def _generate_recommendations(self, quality_metrics: Dict[str, Any], df: pd.DataFrame) -> List[str]:
        """Generate actionable recommendations based on quality analysis"""
        recommendations = []
        
        try:
            # Completeness recommendations
            if quality_metrics.get('completeness', 100) < 95:
                recommendations.append("Consider data imputation strategies for missing values")
                recommendations.append("Investigate root causes of missing data")
            
            # Consistency recommendations
            if quality_metrics.get('consistency', 100) < 90:
                recommendations.append("Standardize data formats across columns")
                recommendations.append("Implement data validation rules during collection")
            
            # Validity recommendations
            if quality_metrics.get('validity', 100) < 95:
                recommendations.append("Review and clean invalid data entries")
                recommendations.append("Establish data validation constraints")
            
            # Uniqueness recommendations
            if quality_metrics.get('uniqueness', 100) < 80:
                recommendations.append("Remove or consolidate duplicate records")
                recommendations.append("Implement unique constraints where appropriate")
            
            # General recommendations based on overall score
            overall_score = quality_metrics.get('overall_score', 100)
            if overall_score < 85:
                recommendations.append("Consider comprehensive data cleaning procedures")
                recommendations.append("Implement ongoing data quality monitoring")
        
        except Exception as e:
            self.logger.warning(f"Error generating recommendations: {str(e)}")
            recommendations.append("Manual data review recommended")
        
        return recommendations
    
    def _empty_dataset_quality(self, dataset_name: str) -> Dict[str, Any]:
        """Return quality metrics for empty dataset"""
        return {
            'dataset': dataset_name,
            'completeness': 0.0,
            'consistency': 0.0,
            'validity': 0.0,
            'uniqueness': 0.0,
            'accuracy': 0.0,
            'overall_score': 0.0,
            'issues': ['Dataset is empty or could not be loaded'],
            'recommendations': ['Verify dataset source and reload data'],
            'detailed_analysis': {}
        }
    
    def _error_quality_result(self, dataset_name: str, error_message: str) -> Dict[str, Any]:
        """Return quality metrics for error case"""
        return {
            'dataset': dataset_name,
            'completeness': 0.0,
            'consistency': 0.0,
            'validity': 0.0,
            'uniqueness': 0.0,
            'accuracy': 0.0,
            'overall_score': 0.0,
            'issues': [f'Quality analysis failed: {error_message}'],
            'recommendations': ['Check data format and accessibility'],
            'detailed_analysis': {}
        }